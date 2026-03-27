"""
Performance and load testing examples using Locust
Run with: locust -f tests/performance/test_example_locust.py
"""
from locust import HttpUser, task, between
import random


class NewsradarAPIUser(HttpUser):
    """Simulated user for NEWSRADAR API load testing"""
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    
    def on_start(self):
        """Setup - runs once per user"""
        self.alert_ids = list(range(1, 101))  # Assume 100 alerts exist
        self.channel_ids = list(range(1, 51))  # Assume 50 channels exist

    @task(3)
    def get_alerts(self):
        """Task: Retrieve all alerts (weighted 3x)"""
        self.client.get("/alerts/", timeout=5)

    @task(2)
    def get_alert_detail(self):
        """Task: Get specific alert (weighted 2x)"""
        alert_id = random.choice(self.alert_ids)
        self.client.get(f"/alerts/{alert_id}/", timeout=5)

    @task(2)
    def create_alert(self):
        """Task: Create new alert (weighted 2x)"""
        alert_data = {
            "name": f"Test Alert {random.randint(1, 1000)}",
            "keywords": ["test", "example"],
            "category": "Technology",
            "channels": random.sample(self.channel_ids, 3)
        }
        self.client.post("/alerts/", json=alert_data, timeout=5)

    @task(1)
    def get_rss_channels(self):
        """Task: Retrieve RSS channels (weighted 1x)"""
        self.client.get("/channels/", timeout=5)

    @task(1)
    def search_articles(self):
        """Task: Search for articles (weighted 1x)"""
        keywords = ["python", "testing", "news", "api"]
        query = random.choice(keywords)
        self.client.get(f"/articles/search/?q={query}", timeout=5)


class NewsradarStressTest(HttpUser):
    """Stress test user with rapid requests"""
    
    wait_time = between(0.1, 0.5)  # Very short wait times
    
    @task
    def stress_test_api(self):
        """Rapid API calls for stress testing"""
        endpoints = [
            "/alerts/",
            "/channels/",
            "/articles/"
        ]
        endpoint = random.choice(endpoints)
        self.client.get(endpoint, timeout=5)
