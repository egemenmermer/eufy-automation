#!/bin/bash

echo "🐳 Setting up WordPress with Docker for Amelia Booking Testing"
echo "=============================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down

# Start the services
echo "🚀 Starting WordPress, MySQL, and phpMyAdmin..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if WordPress is accessible
echo "🔍 Checking WordPress availability..."
for i in {1..10}; do
    if curl -s http://localhost:8080 > /dev/null; then
        echo "✅ WordPress is ready!"
        break
    else
        echo "   Waiting for WordPress... (attempt $i/10)"
        sleep 10
    fi
done

echo ""
echo "🎉 WordPress Environment Ready!"
echo "================================"
echo ""
echo "📍 Access URLs:"
echo "   WordPress Site:    http://localhost:8080"
echo "   phpMyAdmin:        http://localhost:8081"
echo ""
echo "🔑 Database Credentials:"
echo "   Database: wordpress"
echo "   Username: wordpress"
echo "   Password: wordpress_password"
echo ""
echo "📋 Next Steps:"
echo "1. Open http://localhost:8080 in your browser"
echo "2. Complete WordPress installation:"
echo "   - Site Title: Eufy Automation Test"
echo "   - Admin Username: admin"
echo "   - Admin Password: (choose a strong password)"
echo "   - Admin Email: ethical.owl.eva@gmail.com"
echo "3. Install and configure Amelia plugin"
echo "4. Connect Amelia to your Google Calendar"
echo "5. Test booking flow with automation"
echo ""
echo "💡 Tips:"
echo "   - Use 'docker-compose logs wordpress' to see WordPress logs"
echo "   - Use 'docker-compose down' to stop all services"
echo "   - Plugin files can be added to ./wordpress-plugins/ directory"
echo ""
echo "🔗 Integration with Eufy Automation:"
echo "   - Your automation is already running and monitoring calendar"
echo "   - Configure Amelia to sync with calendar ID: $(grep GOOGLE_CALENDAR_ID .env | cut -d= -f2)"
echo "   - Test bookings will trigger door unlock automation"
echo "" 