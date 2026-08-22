package config

import (
	"context"
	"log"

	"github.com/sethvargo/go-envconfig"
)

type Config struct {
	Env           string           `env:"APP_ENV,default=development"`
	EnableSwagger bool             `env:"ENABLE_SWAGGER,default=false"`
	Server        ServerConfig     `env:",prefix=SERVER_"`
	ClickHouse    ClickHouseConfig `env:",prefix=CLICKHOUSE_"`
	Redis         RedisConfig      `env:",prefix=REDIS_"`
	CORS          CORSConfig       `env:",prefix=CORS_"`
}

type CORSConfig struct {
	AllowedOrigins []string `env:"ALLOWED_ORIGINS,default=http://localhost:4321"`
	AllowedMethods []string `env:"ALLOWED_METHODS,default=GET,POST,PUT,DELETE,OPTIONS"`
	AllowedHeaders []string `env:"ALLOWED_HEADERS,default=Accept,Authorization,Content-Type,X-Requested-With"`
	MaxAge         int      `env:"MAX_AGE,default=300"`
}

type ServerConfig struct {
	Host         string `env:"HOST,default=0.0.0.0"`
	Port         string `env:"PORT,default=8080"`
	ReadTimeout  int    `env:"READ_TIMEOUT,default=30"`
	WriteTimeout int    `env:"WRITE_TIMEOUT,default=30"`
}

type ClickHouseConfig struct {
	Host     string `env:"HOST,default=127.0.0.1"`
	Port     string `env:"PORT,default=9000"`
	Database string `env:"DATABASE,default=hotspot"`
	Username string `env:"USERNAME,default=default"`
	Password string `env:"PASSWORD,default="`
}

type RedisConfig struct {
	Host     string `env:"HOST,default=localhost"`
	Port     int    `env:"PORT,default=6379"`
	Password string `env:"PASSWORD,default="`
	DB       int    `env:"DB,default=0"`
}

func Load() *Config {
	var cfg Config
	if err := envconfig.ProcessWith(context.Background(), &envconfig.Config{
		Target: &cfg,
	}); err != nil {
		log.Fatalf("failed to process config: %v", err)
	}

	return &cfg
}
