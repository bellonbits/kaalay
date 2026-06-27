import requests
import json
import time

BASE_URL = "http://127.0.0.1:3000/api/v1"

def log_test_step(step_name, description):
    print("\n" + "=" * 60)
    print(f"🔹 STEP: {step_name}")
    print(f"🔸 {description}")
    print("=" * 60)

def test_w3w_caching():
    log_test_step("what3words Caching & Latency Test", "Verifying the Redis cache proxies queries and serves repeat requests rapidly.")
    
    import random
    lat = -0.75735 + random.uniform(-0.005, 0.005)
    lng = 36.47158 + random.uniform(-0.005, 0.005)
    url = f"{BASE_URL}/location/convert-to-words?lat={lat}&lng={lng}"
    
    # First request: should hit W3W API or mock converter and write to cache
    t0 = time.perf_counter()
    r1 = requests.get(url)
    t1 = time.perf_counter()
    d1 = t1 - t0
    
    assert r1.status_code == 200, f"Request failed: {r1.status_code}"
    res1 = r1.json()
    assert res1.get("success") is True
    words = res1["data"]["words"]
    print(f"First request returned words: {words}")
    print(f"First request latency: {d1:.4f}s")
    
    # Second request: must hit Redis cache and be extremely fast
    t2 = time.perf_counter()
    r2 = requests.get(url)
    t3 = time.perf_counter()
    d2 = t3 - t2
    
    assert r2.status_code == 200
    res2 = r2.json()
    assert res2["data"]["words"] == words
    print(f"Second request latency: {d2:.4f}s")
    
    # Cache hit check
    print(f"⚡ Cache speedup: {d1 / d2:.1f}x faster")
    assert d2 < d1 or d2 < 0.05, f"Second request was not served from Redis cache quickly enough: {d2:.4f}s"
    
    # Test reverse lookup caching
    reverse_url = f"{BASE_URL}/location/convert-to-coordinates?words={words}"
    t4 = time.perf_counter()
    r3 = requests.get(reverse_url)
    t5 = time.perf_counter()
    d3 = t5 - t4
    
    assert r3.status_code == 200
    res3 = r3.json()
    assert abs(res3["data"]["latitude"] - lat) < 0.01
    print(f"Reverse lookup (cache hit due to dual-caching): {res3['data']}")
    print(f"Reverse request latency: {d3:.4f}s")

def test_passwordless_phone_auth_flow():
    log_test_step("Passwordless Phone Auth Flow Test", "Simulating direct phone number check, registrations, and auto logins.")
    
    # Generates a random phone number for a new user test
    phone = f"+25471{int(time.time()) % 10000000:07d}"
    print(f"Testing with new phone number: {phone}")
    
    # 1. Login with a new phone number -> should identify as new user
    login_url = f"{BASE_URL}/auth/login"
    r_login_new = requests.post(login_url, json={"phoneNumber": phone})
    assert r_login_new.status_code == 200
    res_login_new = r_login_new.json()
    assert res_login_new["success"] is True
    assert res_login_new["data"]["isNewUser"] is True, "Expected user to be marked as new"
    print("Direct phone number check successfully flagged new user!")
    
    # 2. Register Profile directly without OTP constraints
    register_url = f"{BASE_URL}/auth/register"
    email = f"test-{int(time.time())}@kaalay.io"
    reg_payload = {
        "phoneNumber": phone,
        "fullName": "Integration Tester",
        "role": "rider",
        "email": email
    }
    r_reg = requests.post(register_url, json=reg_payload)
    assert r_reg.status_code == 200
    res_reg = r_reg.json()
    assert res_reg["success"] is True
    user_data = res_reg["data"]["user"]
    token = res_reg["data"]["accessToken"]
    assert user_data["fullName"] == "Integration Tester"
    assert user_data["role"] == "rider"
    print("New user registered successfully!")
    
    # 3. Login again with same number -> should immediately log in
    r_login_existing = requests.post(login_url, json={"phoneNumber": phone})
    assert r_login_existing.status_code == 200
    res_login_existing = r_login_existing.json()
    assert res_login_existing["success"] is True
    assert res_login_existing["data"]["isNewUser"] is False, "Expected user to be logged in directly"
    assert res_login_existing["data"]["accessToken"] is not None
    print("Existing user logged in instantly!")
    
    # 4. Update Profile / Register as Driver
    plate = f"KDG {int(time.time()) % 1000:03d}T"
    headers = {"Authorization": f"Bearer {token}"}
    r_reg_driver = requests.post(f"{BASE_URL}/drivers/register", headers=headers, json={
        "vehicleModel": "Toyota Probox",
        "vehicleColor": "White",
        "licensePlate": plate,
        "vehicleCategory": "economy"
    })
    assert r_reg_driver.status_code == 200
    print(f"Driver Registration: {r_reg_driver.json()['data']}")
    
    # Fetch updated profile via /me
    me_url = f"{BASE_URL}/auth/me"
    r_me = requests.get(me_url, headers=headers)
    assert r_me.status_code == 200
    updated_user = r_me.json()["data"]
    assert updated_user["role"] == "driver"
    assert updated_user["vehicleCategory"] == "economy"
    assert updated_user["licensePlate"] == plate
    print("Profile successfully updated to driver via command center!")

def test_sos_flow():
    log_test_step("SOS / I'm Lost Emergency Broadcast Flow Test", "Verifying POST /sos, active Redis telemetry state, and PATCH cancellation.")
    
    # 1. Register a fresh test user to get a token
    phone = f"+25472{int(time.time()) % 10000000:07d}"
    register_url = f"{BASE_URL}/auth/register"
    email = f"sos-test-{int(time.time())}@kaalay.io"
    reg_payload = {
        "phoneNumber": phone,
        "fullName": "SOS Emergency Tester",
        "role": "rider",
        "email": email
    }
    r_reg = requests.post(register_url, json=reg_payload)
    assert r_reg.status_code == 200
    res_reg = r_reg.json()
    token = res_reg["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Trigger SOS Broadcast
    sos_url = f"{BASE_URL}/location/sos"
    sos_payload = {
        "lat": -1.2921,
        "lng": 36.8219,
        "accuracy": 5.0,
        "w3w": "custom.sos.words",
        "message": "HELP ME: I am completely lost!"
    }
    r_sos = requests.post(sos_url, json=sos_payload, headers=headers)
    assert r_sos.status_code == 200, f"SOS trigger failed: {r_sos.text}"
    res_sos = r_sos.json()
    assert res_sos["success"] is True
    share_code = res_sos["data"]["shareCode"]
    assert share_code is not None
    print(f"SOS Broadcast initiated. Share code generated: {share_code}")
    
    # 3. Retrieve and assert telemetry Redis key state
    share_url = f"{BASE_URL}/location/share/{share_code}"
    r_share = requests.get(share_url)
    assert r_share.status_code == 200
    res_share = r_share.json()
    assert res_share["success"] is True
    data = res_share["data"]
    assert data["requestType"] == "lost"
    assert data["lat"] == -1.2921
    assert data["lng"] == 36.8219
    assert data["user"]["fullName"] == "SOS Emergency Tester"
    print("Redis active emergency state verified successfully!")
    
    # 4. Terminate SOS Broadcast
    cancel_url = f"{BASE_URL}/location/share/{share_code}"
    r_cancel = requests.patch(cancel_url, json={"status": "ended"})
    assert r_cancel.status_code == 200
    res_cancel = r_cancel.json()
    assert res_cancel["success"] is True
    assert res_cancel["data"]["status"] == "ended"
    print("SOS Cancellation executed successfully!")
    
    # 5. Assert deletion / expiration
    r_expired = requests.get(share_url)
    assert r_expired.status_code == 404
    print("SOS Redis session purged successfully!")

def main():
    print("🚀 STARTING KAALAY SPEC-FIRST INTEGRATION TESTS")
    test_w3w_caching()
    test_passwordless_phone_auth_flow()
    test_sos_flow()
    print("\n✅ ALL KAALAY INTEGRATION TESTS PASSED SUCCESSFULY!")

if __name__ == "__main__":
    main()
