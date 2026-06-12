package controllers

import (
	"encoding/json"
	"net/http"
)

type ResourceResponse struct {
	Message string `json:"message"`
}

// GetResourcesHandler lists resources
func GetResourcesHandler(w http.ResponseWriter, r *http.Request) {
	resp := ResourceResponse{Message: "Get resources endpoint hit ✅"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// CreateResourceHandler adds a new resource
func CreateResourceHandler(w http.ResponseWriter, r *http.Request) {
	resp := ResourceResponse{Message: "Create resource endpoint hit ✅"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
