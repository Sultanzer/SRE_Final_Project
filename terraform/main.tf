provider "kubernetes" {
  config_path = pathexpand(var.kube_config_path)
}

resource "kubernetes_namespace" "capstone" {
  metadata {
    name = var.namespace

    labels = {
      project    = "sre-capstone"
      managed_by = "terraform"
    }
  }
}

resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "ecommerce-api-config"
    namespace = kubernetes_namespace.capstone.metadata[0].name
  }

  data = {
    SERVICE_NAME = "ecommerce-api"
    NODE_ENV     = "production"
  }
}

resource "kubernetes_deployment" "api" {
  metadata {
    name      = "ecommerce-api"
    namespace = kubernetes_namespace.capstone.metadata[0].name

    labels = {
      app = "ecommerce-api"
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = "ecommerce-api"
      }
    }

    template {
      metadata {
        labels = {
          app = "ecommerce-api"
        }
      }

      spec {
        container {
          name              = "ecommerce-api"
          image             = var.image
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 4000
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }

            limits = {
              cpu    = "500m"
              memory = "256Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = 4000
            }

            initial_delay_seconds = 5
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 4000
            }

            initial_delay_seconds = 10
            period_seconds        = 20
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "api" {
  metadata {
    name      = "ecommerce-api"
    namespace = kubernetes_namespace.capstone.metadata[0].name

    labels = {
      app = "ecommerce-api"
    }
  }

  spec {
    selector = {
      app = "ecommerce-api"
    }

    port {
      name        = "http"
      port        = 4000
      target_port = 4000
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v2" "api" {
  metadata {
    name      = "ecommerce-api-hpa"
    namespace = kubernetes_namespace.capstone.metadata[0].name
  }

  spec {
    min_replicas = 2
    max_replicas = 6

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.api.metadata[0].name
    }

    metric {
      type = "Resource"

      resource {
        name = "cpu"

        target {
          type                = "Utilization"
          average_utilization = 60
        }
      }
    }
  }
}

output "namespace" {
  value = kubernetes_namespace.capstone.metadata[0].name
}

output "service_name" {
  value = kubernetes_service.api.metadata[0].name
}