#!/bin/bash

# Deployment script for English Learning Backend
# This script rebuilds and redeploys the backend service to Google Cloud Run

set -e  # Exit on any error

# Configuration
PROJECT_ID="english-learning-backend"
REGION="asia-east1"
SERVICE_NAME="english-learning-backend"
REPOSITORY="english-learning"
IMAGE_NAME="backend"
SQL_INSTANCE="comic-backend-wudypig-20250803:asia-east1:comics-db-dev"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting deployment process...${NC}\n"

# Step 1: Build Docker image
echo -e "${YELLOW}📦 Step 1: Building Docker image...${NC}"
docker build --platform linux/amd64 \
  -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest \
  .

echo -e "${GREEN}✓ Docker image built successfully${NC}\n"

# Step 2: Push to Artifact Registry
echo -e "${YELLOW}📤 Step 2: Pushing image to Artifact Registry...${NC}"
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest

echo -e "${GREEN}✓ Image pushed successfully${NC}\n"

# Step 3: Run Database Migrations
echo -e "${YELLOW}🗄️  Step 3: Running database migrations...${NC}"
gcloud run jobs execute migrate-db --region=${REGION} --wait

echo -e "${GREEN}✓ Database migrations complete${NC}\n"

# Step 4: Deploy to Cloud Run
echo -e "${YELLOW}🌐 Step 4: Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:latest \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances=${SQL_INSTANCE} \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,DATABASE_URL=DATABASE_URL:latest,REFRESH_TOKEN_SECRET=REFRESH_TOKEN_SECRET:latest" \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10

echo -e "${GREEN}✓ Deployment complete!${NC}\n"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --format="value(status.url)")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo -e "${BLUE}Service URL: ${NC}${SERVICE_URL}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Optional: Test the service
read -p "Would you like to test the service? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Testing registration endpoint...${NC}"
    curl -X POST ${SERVICE_URL}/auth/register \
      -H "Content-Type: application/json" \
      -d '{
        "email": "deploy-test@example.com",
        "password": "test123",
        "nickname": "Deploy Test"
      }'
    echo -e "\n"
fi

echo -e "${GREEN}Done!${NC}"
