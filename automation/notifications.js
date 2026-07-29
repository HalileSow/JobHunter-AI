import fetch from 'node-fetch';

/**
 * Envoie une notification via Webhook (Telegram/Slack).
 * @param {Object} job - L'offre d'emploi à notifier.
 */
export async function sendJobNotification(job) {
    const webhookUrl = process.env.WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.warn('⚠️ WEBHOOK_URL non configuré. Notification ignorée.');
        return;
    }

    const payload = {
        text: `🚀 *Nouvelle offre prometteuse détectée !*
🏢 *Entreprise :* ${job.company}
💼 *Titre :* ${job.title}
📊 *Score :* ${job.score}/100
🔗 *Lien :* ${job.link}`
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log(`✅ Notification envoyée pour ${job.company}`);
    } catch (error) {
        console.error(`❌ Erreur d'envoi de la notification pour ${job.company}:`, error.message);
    }
}
