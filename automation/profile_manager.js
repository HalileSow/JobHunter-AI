import { initDb } from './db.js';

function profileValues(profileData, userId) {
    if (!Number.isInteger(Number(userId))) throw new Error('userId obligatoire pour mettre à jour un profil.');
    return {
        id: Number(userId),
        user_id: Number(userId),
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        dob: profileData.dob || '',
        nationality: profileData.nationality || '',
        address: profileData.address || '',
        phone: profileData.phone || '',
        email: profileData.email || '',
        photo_path: profileData.photo_path || '',
        languages: JSON.stringify(profileData.languages || []),
        skills: JSON.stringify(profileData.skills || []),
        experience: profileData.experience || '',
        education: profileData.education || '',
        availability: profileData.availability || ''
    };
}

export async function updateProfile(profileData, userId) {
    const db = await initDb();
    const values = profileValues(profileData, userId);
    const existing = await db('profile').where({ user_id: values.user_id }).select('user_id').first();
    if (existing) await db('profile').where({ user_id: values.user_id }).update(values);
    else await db('profile').insert(values);
    console.log("✅ Profil mis à jour.");
}

export async function getProfile(userId) {
    const db = await initDb();
    return db('profile').where({ user_id: Number(userId) }).first();
}
