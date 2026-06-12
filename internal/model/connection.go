package model

import "gorm.io/gorm"

type Connection struct {
	gorm.Model
	UserID     uint `gorm:"not null"`
	ResourceID uint `gorm:"not null"`
	FromID     uint `json:"from_id"`
	ToID       uint `json:"to_id"`
	Accepted   bool `json:"accepted"`
}
