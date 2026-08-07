/**
 * Sanitize a string for use as a filename.
 * - Removes forbidden characters
 * - Replaces accents with ASCII equivalents
 * - Replaces spaces with underscores
 * - Limits length to maxLen (default 80)
 * - Appends a short unique suffix if needed
 */
export function sanitizeFilename(value = '', { maxLen = 80 } = {}) {
    let str = String(value);

    // Replace accents with ASCII equivalents
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Remove forbidden characters (keep alphanumeric, underscore, hyphen, dot)
    str = str.replace(/[^a-zA-Z0-9_.\-]/g, '_');

    // Collapse multiple underscores
    str = str.replace(/_+/g, '_');

    // Trim leading/trailing underscores
    str = str.replace(/^_|_$/g, '');

    // Truncate to maxLen
    if (str.length > maxLen) {
        str = str.substring(0, maxLen);
        // Remove trailing underscore after truncation
        str = str.replace(/_+$/, '');
    }

    return str || 'document';
}

/**
 * Build a short, unique PDF filename that avoids ENAMETOOLONG.
 * Example: cover_FranceTravail_20260806_154821.pdf
 */
export function buildPdfFileName(prefix = 'cover', company = '', lang = 'fr') {
    const safeCompany = sanitizeFilename(company, { maxLen: 40 });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const unique = Math.random().toString(36).substring(2, 6);

    const base = `${prefix}_${safeCompany}_${ts}_${unique}`.substring(0, 80);
    return `${base}.pdf`;
}
