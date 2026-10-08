-- Executado uma vez pelo MySQL do docker-compose: cria o banco de testes
-- e dá acesso ao mesmo usuário usado no banco de desenvolvimento.
CREATE DATABASE IF NOT EXISTS mesas_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON mesas_test.* TO 'mesas'@'%';
FLUSH PRIVILEGES;
