import { db } from '../automation/db.js';

async function diagnose() {
    console.log("=== DIAGNOSTIC DES DONNÉES ===");
    try {
        const users = await db('users').count('id as c');
        const jobs = await db('jobs').count('id as c');
        const jobsNull = await db('jobs').whereNull('user_id').count('id as c');
        const cvs = await db('cvs').count('id as c');
        const cvsNull = await db('cvs').whereNull('user_id').count('id as c');
        const profile = await db('profile').count('id as c');
        const profileNull = await db('profile').whereNull('user_id').count('id as c');
        const searchRuns = await db('search_runs').count('id as c');
        const searchRunsNull = await db('search_runs').whereNull('user_id').count('id as c');
        
        console.log(`- Utilisateurs : ${users[0].c}`);
        console.log(`- Offres (Jobs) : ${jobs[0].c} (Dont user_id NULL: ${jobsNull[0].c})`);
        console.log(`- CVs : ${cvs[0].c} (Dont user_id NULL: ${cvsNull[0].c})`);
        console.log(`- Profils : ${profile[0].c} (Dont user_id NULL: ${profileNull[0].c})`);
        console.log(`- Recherches (Search Runs) : ${searchRuns[0].c} (Dont user_id NULL: ${searchRunsNull[0].c})`);
        
    } catch (e) {
        console.error("Erreur de diagnostic:", e);
    }
    process.exit(0);
}

diagnose();
