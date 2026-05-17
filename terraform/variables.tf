variable "namespace" {
  description = "Kubernetes namespace for the capstone project"
  type        = string
  default     = "sre-capstone"
}

variable "kube_config_path" {
  description = "Path to kubeconfig. For Docker Desktop on Windows use ~/.kube/config"
  type        = string
  default     = "~/.kube/config"
}

variable "image" {
  description = "Docker image for ecommerce API"
  type        = string
  default     = "ghcr.io/OWNER/sre-capstone-ecommerce-api:latest"
}

variable "replicas" {
  description = "Initial API replica count"
  type        = number
  default     = 2
}
