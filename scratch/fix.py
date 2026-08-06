import re

with open('site/server.mjs', 'r') as f:
    content = f.read()

# Replace profile queries
content = re.sub(r"db\('profile'\)\.where\(\{ id: 1 \}\)", r"db('profile').where({ user_id: req.user.id })", content)
content = re.sub(r"id: 1,\n\s+first_name", r"user_id: req.user.id,\n                    first_name", content)
content = re.sub(r"\.onConflict\('id'\)", r".onConflict('user_id')", content) # Wait, is user_id unique in profile? Maybe we just leave it without onConflict or use user_id. Let's just update using where and insert.

# Actually, an easier way is to just write a manual node script using `fs` that replaces exactly what we want.
