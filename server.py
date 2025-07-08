#!/usr/bin/env python3
import os
import tempfile
from flask import Flask, request, send_file, jsonify, session, redirect, url_for
from flask_cors import CORS
import zipfile
import shutil
import uuid

# Stripe integration
import stripe

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "supersecretkey")
CORS(app)

UPLOAD_FOLDER = tempfile.gettempdir()
THEME_FOLDER = os.path.join(UPLOAD_FOLDER, "wp_themes")
os.makedirs(THEME_FOLDER, exist_ok=True)

# Stripe config
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "sk_test_...")
STRIPE_PRICE_ID = "price_1RiJcoHfyc8LBm6b6hIX0SN4"
stripe.api_key = STRIPE_SECRET_KEY

# In-memory store for subscription status (for demo; use DB in production)
user_subscriptions = {}

@app.route("/api/upload", methods=["POST"])
def upload_html():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    upload_file = request.files["file"]
    filename = upload_file.filename.lower()

    user_id = session.get("user_id")
    if not user_id:
        user_id = str(uuid.uuid4())
        session["user_id"] = user_id

    user_dir = os.path.join(THEME_FOLDER, user_id)
    os.makedirs(user_dir, exist_ok=True)

    if filename.endswith(".zip"):
        # Save uploaded ZIP
        zip_path = os.path.join(user_dir, "site.zip")
        upload_file.save(zip_path)
        # Validate ZIP: must contain index.html
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                file_list = zf.namelist()
                has_index = any(
                    f.lower().endswith("index.html") and not f.endswith("/")
                    for f in file_list
                )
                if not has_index:
                    os.remove(zip_path)
                    return jsonify({"error": "ZIP file must contain an index.html file."}), 400
        except zipfile.BadZipFile:
            os.remove(zip_path)
            return jsonify({"error": "Uploaded file is not a valid ZIP archive."}), 400
        # For demo, just copy the uploaded ZIP as the theme
        theme_zip_path = os.path.join(user_dir, "wp-theme.zip")
        shutil.copy(zip_path, theme_zip_path)
    elif filename.endswith(".html"):
        # Save uploaded HTML and wrap in a minimal WP theme structure
        html_path = os.path.join(user_dir, "index.html")
        upload_file.save(html_path)
        theme_zip_path = os.path.join(user_dir, "wp-theme.zip")
        with zipfile.ZipFile(theme_zip_path, "w") as zf:
            zf.write(html_path, arcname="wp-content/themes/mytheme/index.html")
    else:
        return jsonify({"error": "Only ZIP or HTML files allowed"}), 400

    return jsonify({"success": True, "user_id": user_id})

@app.route("/api/stripe/create-checkout-session", methods=["POST"])
def create_checkout_session():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "No user session"}), 400

    # Create Stripe Checkout session for subscription
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1,
            }],
            success_url=request.host_url.rstrip("/") + "/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.host_url.rstrip("/") + "/cancel",
            client_reference_id=user_id,
            metadata={"user_id": user_id}
        )
        return jsonify({"checkout_url": checkout_session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    # You should verify the webhook signature in production!
    payload = request.data
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    event = None

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        else:
            event = request.get_json()
    except Exception as e:
        return str(e), 400

    # Handle subscription activation
    if event and event.get("type") == "checkout.session.completed":
        session_obj = event["data"]["object"]
        user_id = session_obj.get("client_reference_id")
        if user_id:
            user_subscriptions[user_id] = True

    return "", 200

@app.route("/api/download", methods=["GET"])
def download_theme():
    user_id = session.get("user_id")
    if not user_id or not user_subscriptions.get(user_id):
        return jsonify({"error": "Subscription required"}), 403

    user_dir = os.path.join(THEME_FOLDER, user_id)
    theme_zip_path = os.path.join(user_dir, "wp-theme.zip")
    if not os.path.exists(theme_zip_path):
        return jsonify({"error": "Theme not found"}), 404

    return send_file(theme_zip_path, as_attachment=True, download_name="wp-theme.zip")

@app.route("/api/subscription-status", methods=["GET"])
def subscription_status():
    user_id = session.get("user_id")
    return jsonify({"subscribed": bool(user_id and user_subscriptions.get(user_id))})

@app.route("/api/health", methods=["GET"])
def health_check():
    return "Flask is running!", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
