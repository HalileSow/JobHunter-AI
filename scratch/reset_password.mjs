import 'dotenv/config';
import bcrypt from 'bcrypt';
import knex from 'knex';
import knexConfig from '../knexfile.cjs';

const db = knex(knexConfig.development);

const email = 'superadmin@jobhunter.local';
const password = 'SuperAdmin2024!';

async function resetPassword() {
    try {
        let user = await db('users').where({ email }).first();
        
        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const [userId] = await db('users').insert({
                email,
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE'
            });
            console.log(`✅ Compte créé pour "${email}"`);
            console.log(`   ID : ${userId}`);
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db('users').where({ id: user.id }).update({ password: hashedPassword });
            console.log(`✅ Mot de passe mis à jour pour "${email}"`);
        }

        console.log(`   Email : ${email}`);
        console.log(`   Mot de passe : ${password}`);
        console.log(`   Rôle : SUPER_ADMIN`);
        console.log('');
        console.log('Vous pouvez maintenant vous connecter avec ces identifiants.');
    } catch (err) {
        console.error('❌ Erreur:', err.message);
    } finally {
        await db.destroy();
    }
}

resetPassword();
