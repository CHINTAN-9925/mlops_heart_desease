pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'mlops_heart'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build --no-cache'
            }
        }

        stage('Test Backend') {
            steps {
                // Spin up only what the health check needs, then tear down
                sh '''
                    docker compose up -d mongo backend
                    echo "Waiting for backend to be ready..."
                    for i in $(seq 1 15); do
                        if docker compose exec -T backend curl -sf http://localhost:5001/health > /dev/null 2>&1; then
                            echo "Backend is healthy."
                            break
                        fi
                        echo "  attempt $i/15 — retrying in 3s..."
                        sleep 3
                    done
                    docker compose exec -T backend curl -sf http://localhost:5001/health
                '''
            }
            post {
                always {
                    sh 'docker compose stop backend mongo || true'
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh 'docker compose up -d --remove-orphans'
            }
        }
    }

    post {
        failure {
            sh 'docker compose down || true'
            echo 'Pipeline failed — all containers stopped.'
        }
        success {
            echo 'Pipeline completed successfully.'
        }
    }
}
