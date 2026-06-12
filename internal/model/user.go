package model

import (
	"gorm.io/gorm"
)

type User struct {
	gorm.Model        // ID, CreatedAt, UpdatedAt, DeletedAt
	Username   string `gorm:"unique;not null" json:"username"`
	Email      string `gorm:"uniqueIndex;not null" json:"email"`
	Password string `gorm:"not null" json:"-"`

	Name      string `json:"name"`
	Bio       string `json:"bio"`
	Skills    string `json:"skills"`
	Batch     string `json:"batch"`
	Location  string `json:"location"`
	AvatarURL string `json:"avatar_url"`
}
