/**
 * SHA-256 via the Web Crypto API.
 *
 * Used to avoid storing the admin passphrase in plaintext. To be clear about
 * what this does and does not buy: hashing means someone reading localStorage
 * does not immediately learn the passphrase. It does NOT make the admin screen
 * secure — all of this runs in the browser, so anyone determined can bypass the
 * check entirely. Real protection requires the privileged operations to live
 * behind a server that authenticates the caller.
 */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
