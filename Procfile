web: gunicorn loan_system_project.wsgi:application --bind "0.0.0.0:$PORT" --workers 3 --timeout 600 --access-logfile - --error-logfile -

# Run periodically via Render Cron Job: python manage.py generate_notifications
# Suggested interval: every 15 minutes
