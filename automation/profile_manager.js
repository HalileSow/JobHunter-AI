import { initDb } from './db.js';

export async function updateProfile(profileData) {
    const db = await initDb();
    const sql = `
        INSERT OR REPLACE INTO profile (
            id, first_name, last_name, dob, nationality, address, 
            phone, email, photo_path, languages, skills, experience, education, availability
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        profileData.first_name, profileData.last_name, profileData.dob, profileData.nationality,
        profileData.address, profileData.phone, profileData.email, profileData.photo_path,
        JSON.stringify(profileData.languages), JSON.stringify(profileData.skills),
        profileData.experience, profileData.education, profileData.availability
    ];
    await db.run(sql, params);
    await db.close();
    console.log("✅ Profil mis à jour.");
}

export async function getProfile() {
    const db = await initDb();
    const profile = await db.get('SELECT * FROM profile WHERE id = 1');
    await db.close();
    return profile;
}
