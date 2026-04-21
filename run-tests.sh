#!/bin/bash
set -e

# Tests backend
cd backend
SQLX_OFFLINE=true JWT_SECRET=test cargo tarpaulin --out Html --output-dir coverage
cd ..

# Tests frontend
cd frontend
npx jest --runInBand --coverage
cd ..