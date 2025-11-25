class EncryptionService {
  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly KEY_LENGTH = 256
  private static async getKey(userId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(userId.padEnd(32, '0').substring(0, 32)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('supascraper_salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
  }
  static async encrypt(data: string, userId: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const key = await this.getKey(userId)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encryptedData = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        encoder.encode(data)
      )
      const encryptedArray = new Uint8Array(encryptedData)
      const combined = new Uint8Array(iv.length + encryptedArray.length)
      combined.set(iv)
      combined.set(encryptedArray, iv.length)
      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }
  static async decrypt(encryptedData: string, userId: string): Promise<string> {
    try {
      const decoder = new TextDecoder()
      const key = await this.getKey(userId)
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
      const iv = combined.slice(0, 12)
      const data = combined.slice(12)
      const decryptedData = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        data
      )
      return decoder.decode(decryptedData)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }
  static async encryptCredentials(credentials: any, userId: string, shouldEncrypt: boolean): Promise<any> {
    if (!shouldEncrypt) return credentials
    const encrypted: any = {}
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && value) {
        encrypted[key] = await this.encrypt(value, userId)
      } else if (typeof value === 'object' && value !== null) {
        encrypted[key] = await this.encryptCredentials(value, userId, true)
      } else {
        encrypted[key] = value
      }
    }
    return encrypted
  }
  static async decryptCredentials(credentials: any, userId: string, shouldDecrypt: boolean): Promise<any> {
    if (!shouldDecrypt || !credentials) return credentials
    const decrypted: any = {}
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && value) {
        try {
          decrypted[key] = await this.decrypt(value, userId)
        } catch {
          decrypted[key] = value
        }
      } else if (typeof value === 'object' && value !== null) {
        decrypted[key] = await this.decryptCredentials(value, userId, true)
      } else {
        decrypted[key] = value
      }
    }
    return decrypted
  }
}
export { EncryptionService }
export default EncryptionService