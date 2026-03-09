/**
 * Extracts initials from a name string.
 * 
 * @param name - The name to extract initials from.
 * @param defaultChar - The default character to return when name is empty or null.
 *                      Defaults to 'C' (representing "Club" as the primary use case).
 * @returns Up to 2 uppercase initials, or the defaultChar if name is empty.
 * 
 * @example
 * // Standard usage:
 * getInitials('John Doe')     // Returns 'JD'
 * getInitials('Alice')        // Returns 'AL'
 * getInitials('J')            // Returns 'JJ'
 * getInitials('')             // Returns 'C'
 * 
 * // With custom default:
 * getInitials('', 'U')        // Returns 'U' (e.g., for "User")
 * getInitials(null, 'X')      // Returns 'X'
 */
export function getInitials(name: string | null | undefined, defaultChar: string = 'C'): string {
  if (!name || !name.trim()) return defaultChar;
  
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 1) {
    const firstPart = parts[0];
    if (firstPart.length === 1) {
      // For single letter names, duplicate the letter (e.g. "J" -> "JJ")
      return (firstPart[0] + firstPart[0]).toUpperCase();
    }
    return firstPart.substring(0, 2).toUpperCase();
  }
  
  return parts
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
