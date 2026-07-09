#!/bin/bash
cd /home/kali/JobHunter-AI/automation
node mock_site.js &
MOCK_PID=$!
sleep 2
node main.js "Allemagne" "Développeur" "Node.js"
kill $MOCK_PID
