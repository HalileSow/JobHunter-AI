import bcrypt from 'bcrypt';
import { db } from '../automation/db.js';

async function seed() {
    const password = await bcrypt.hash('password123', 10);
    
    // Create users if not exist
    const users = [
        { email: 'test1@test.com', role: 'USER' },
        { email: 'test2@test.com', role: 'USER' },
        { email: 'admin@test.com', role: 'SUPER_ADMIN' }
    ];

    for (const u of users) {
        const exists = await db('users').where({ email: u.email }).first();
        if (!exists) {
            await db('users').insert({
                email: u.email,
                password,
                role: u.role
            });
            console.log(`Created ${u.email}`);
        } else {
            // Upgrade role if needed
            await db('users').where({ email: u.email }).update({ role: u.role });
            console.log(`Updated ${u.email}`);
        }
    }
    
    console.log("Seeding complete.");
    process.exit(0);
}

seed().catch(console.error);
