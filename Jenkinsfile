pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'mlops_heart'
        // Docker Desktop on macOS installs docker at /usr/local/bin (Intel) or
        // /opt/homebrew/bin (Apple Silicon). Both are added so it works on either.
        PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // Build backend and frontend images in parallel to save time
        stage('Build') {
            parallel {

                stage('Build Backend') {
                    steps {
                        sh 'docker compose build backend'
                    }
                }

                stage('Build Frontend') {
                    steps {
                        sh 'docker compose build frontend'
                    }
                }
            }
        }

        stage('Test Backend') {
            steps {
                sh '''
                    docker compose up -d mongo backend
                    echo "Waiting for backend to be ready..."
                    for i in $(seq 1 15); do
                        if docker compose exec -T backend python -c \
                            "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')" \
                            > /dev/null 2>&1; then
                            echo "Backend is healthy."
                            break
                        fi
                        echo "  attempt $i/15 — retrying in 3s..."
                        sleep 3
                    done
                    docker compose exec -T backend python -c \
                        "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')"
                    echo "Backend test passed."
                '''
            }
            post {
                always {
                    sh 'docker compose stop backend mongo || true'
                }
            }
        }

        stage('Test Frontend') {
            steps {
                // Frontend depends on backend+mongo being up
                sh '''
                    docker compose up -d mongo backend frontend
                    echo "Waiting for frontend to be ready..."
                    for i in $(seq 1 20); do
                        STATUS=$(docker compose exec -T frontend \
                            node -e "
                                const h = require('http');
                                h.get('http://localhost:3000', (r) => {
                                    process.stdout.write(String(r.statusCode));
                                    process.exit(r.statusCode < 400 ? 0 : 1);
                                }).on('error', () => process.exit(1));
                            " 2>/dev/null || echo "err")
                        if [ "$STATUS" != "err" ] && [ "$STATUS" -lt 400 ] 2>/dev/null; then
                            echo "Frontend is healthy (HTTP $STATUS)."
                            break
                        fi
                        echo "  attempt $i/20 — retrying in 5s..."
                        sleep 5
                    done
                    docker compose exec -T frontend \
                        node -e "
                            const h = require('http');
                            h.get('http://localhost:3000', (r) => {
                                if (r.statusCode < 400) { process.exit(0); }
                                else { process.exit(1); }
                            }).on('error', () => process.exit(1));
                        "
                    echo "Frontend test passed."
                '''
            }
            post {
                always {
                    sh 'docker compose stop frontend backend mongo || true'
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
