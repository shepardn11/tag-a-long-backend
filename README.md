# Tag a Long - Backend API

RESTful API backend for the Tag a Long social app.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens (min 32 characters)
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (e.g., us-west-2)
- `AWS_S3_BUCKET`: S3 bucket name for uploads
- `FIREBASE_PROJECT_ID`: Firebase project ID for push notifications
- `FIREBASE_PRIVATE_KEY`: Firebase private key
- `FIREBASE_CLIENT_EMAIL`: Firebase client email

### 3. Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login

### Profile
- `GET /api/profile/me` - Get current user profile
- `GET /api/profile/:username` - Get user by username
- `PUT /api/profile/me` - Update profile
- `POST /api/profile/me/photo` - Upload profile photo

### Listings
- `GET /api/listings/feed` - Get activity feed
- `POST /api/listings` - Create new listing
- `DELETE /api/listings/:id` - Delete listing

### Requests
- `POST /api/requests` - Send tag along request
- `GET /api/requests/received` - Get received requests
- `GET /api/requests/sent` - Get sent requests
- `PUT /api/requests/:id/accept` - Accept request
- `PUT /api/requests/:id/reject` - Reject request

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `POST /api/notifications/register-token` - Register FCM token
- `DELETE /api/notifications/unregister-token` - Unregister FCM token

### Health Check
- `GET /health` - Server health status

## Project Structure
```
src/
├── config/         # Configuration files (database, multer, etc.)
├── controllers/    # Request handlers
├── middleware/     # Express middleware (auth, validation, etc.)
├── prisma/         # Prisma schema
├── routes/         # API routes
├── services/       # Business logic (S3, FCM, etc.)
├── utils/          # Utilities (JWT, validators, etc.)
└── server.js       # Entry point
```

## Development

### Database Migrations
```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Testing
Use tools like Postman or curl to test endpoints. Example:

```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "display_name": "Test User",
    "username": "testuser",
    "date_of_birth": "2000-01-01",
    "city": "Provo"
  }'
```

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use a production-grade database (not localhost)
3. Set strong `JWT_SECRET`
4. Configure CORS origins properly
5. Enable HTTPS
6. Set up monitoring and logging
7. Configure rate limiting appropriately

## Security Notes

- All passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days
- Rate limiting is enabled on all routes
- Input validation on all endpoints
- Image uploads are sanitized and resized
- HTTPS required in production

## License
MIT
