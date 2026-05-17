from locust import HttpUser, task, between
import random

class EcommerceUser(HttpUser):
    wait_time = between(0.2, 1.0)

    @task(5)
    def list_products(self):
        self.client.get('/api/products')

    @task(2)
    def get_product(self):
        self.client.get(f'/api/products/{random.randint(1,3)}')

    @task(1)
    def create_order(self):
        self.client.post('/api/orders', json={"productId": random.randint(1,3), "quantity": 1})

    @task(1)
    def synthetic_error(self):
        # Low-frequency controlled error to demonstrate alerting.
        self.client.get('/api/error', name='/api/error')
