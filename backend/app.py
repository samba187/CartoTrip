#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Travel Tracker PWA - Backend MongoDB
====================================

API endpoints:
- /api/auth/register, /api/auth/login
- /api/users/me (GET/PUT), /api/users/me/avatar (POST), /api/users/<id>/avatar (GET)
- /api/travels (GET/POST), /api/travels/<id> (GET/DELETE)
- /api/cities/<id> (GET/PUT)
- /api/cities/<id>/photos (POST) ; /api/photos/<id> (GET base64) ; /api/photos/<id>/raw (GET) ; /api/photos/<id> (DELETE)
- /api/cities/<id>/notes (POST) ; /api/notes/<id> (PUT/DELETE)
- /api/stats (GET)

Environment variables:
  JWT_SECRET_KEY=change_me
  MONGODB_URI=mongodb://localhost:27017/travel_tracker (default)
  UPLOAD_FOLDER=uploads (default)
"""

import os
import base64
import mimetypes
from datetime import datetime, date
from typing import Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId

from flask import Flask, request, jsonify, abort, send_file
from flask_cors import CORS
import re
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from passlib.hash import bcrypt
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-production')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')

# CORS pour le frontend React (localhost + IP locale + ports 3000/3001)
local_ip = os.getenv('LOCAL_IP')
frontend_origin = os.getenv('FRONTEND_ORIGIN')

# Autorise localhost sur n'importe quel port + IP locale sur n'importe quel port
allowed_origins = [re.compile(r"^http://localhost:\\d+$")]
if local_ip:
    allowed_origins.append(re.compile(rf"^http://{re.escape(local_ip)}:\\d+$"))
if frontend_origin:
    allowed_origins.append(frontend_origin)

CORS(app, origins=allowed_origins, supports_credentials=True)

# JWT Manager
jwt = JWTManager(app)

# MongoDB Connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/travel_tracker')
try:
    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()
    print(f"✅ Connected to MongoDB: {MONGODB_URI}")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    exit(1)

# Collections
users_collection = db.users
travels_collection = db.travels
cities_collection = db.cities
photos_collection = db.photos
notes_collection = db.notes

# Ensure upload folder exists
upload_dir = os.path.join(os.path.dirname(__file__), app.config['UPLOAD_FOLDER'])
os.makedirs(upload_dir, exist_ok=True)

# ------------------------------------------------------------
# Utility Functions
# ------------------------------------------------------------

def str_to_objectid(id_str):
    """Convert string to ObjectId, return None if invalid"""
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None

def objectid_to_str(obj_id):
    """Convert ObjectId to string"""
    return str(obj_id) if obj_id else None

def parse_date(date_str):
    """Parse date string to ISO string for MongoDB"""
    if not date_str:
        return None
    try:
        # Parse and return as ISO string for MongoDB compatibility
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.date().isoformat()
    except:
        return None

def allowed_image(filename):
    """Check if file is an allowed image type"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def user_to_dict(user):
    """Convert user document to dict"""
    if not user:
        return None
    return {
        'id': objectid_to_str(user['_id']),
        'username': user.get('username'),
        'email': user.get('email'),
        'preferences': user.get('preferences', {}),
        'created_at': user.get('created_at'),
        'has_avatar': user.get('avatar_filename') is not None
    }

def travel_to_dict(travel):
    """Convert travel document to dict with cities"""
    if not travel:
        return None
    
    # Get cities for this travel
    cities = list(cities_collection.find({'travel_id': travel['_id']}))
    cities_list = []
    
    for city in cities:
        # Get photos for this city
        photos = list(photos_collection.find({'city_id': city['_id']}))
        photo_list = [{'id': objectid_to_str(p['_id']), 'filename': p['filename'], 'caption': p.get('caption', '')} for p in photos]
        
        # Get notes for this city
        notes = list(notes_collection.find({'city_id': city['_id']}))
        notes_list = [{
            'id': objectid_to_str(n['_id']), 
            'title': n.get('title', ''), 
            'content': n['content'], 
            'rating': n.get('rating'),
            'category': n.get('category', ''),
            'is_favorite': n.get('is_favorite', False),
            'tags': n.get('tags', []),
            'created_at': n.get('created_at')
        } for n in notes]
        
        cities_list.append({
            'id': objectid_to_str(city['_id']),
            'name': city['name'],
            'latitude': city.get('latitude'),
            'longitude': city.get('longitude'),
            'arrival_date': city.get('arrival_date'),
            'departure_date': city.get('departure_date'),
            'notes': city.get('notes', ''),
            'photos': photo_list,
            'city_notes': notes_list
        })
    
    return {
        'id': objectid_to_str(travel['_id']),
        'country': travel['country'],
        'latitude': travel.get('latitude'),
        'longitude': travel.get('longitude'),
        'start_date': travel.get('start_date'),
        'end_date': travel.get('end_date'),
        'notes': travel.get('notes', ''),
        'created_at': travel.get('created_at'),
        'cities': cities_list
    }

# ------------------------------------------------------------
# Authentication
# ------------------------------------------------------------

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'missing_fields'}), 400

    # Check if user exists
    if users_collection.find_one({'email': email}):
        return jsonify({'error': 'user_exists'}), 409

    # Create user
    user_doc = {
        'username': username,
        'email': email,
        'password': bcrypt.hash(password),
        'preferences': {},
        'created_at': datetime.utcnow(),
        'avatar_filename': None
    }
    
    result = users_collection.insert_one(user_doc)
    return jsonify({'id': objectid_to_str(result.inserted_id)}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'missing_fields'}), 400

    user = users_collection.find_one({'email': email})
    if not user or not bcrypt.verify(password, user['password']):
        return jsonify({'error': 'bad_credentials'}), 401

    token = create_access_token(identity=objectid_to_str(user['_id']))
    return jsonify({'access_token': token}), 200

# ------------------------------------------------------------
# Users
# ------------------------------------------------------------

@app.route('/api/users/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = str_to_objectid(get_jwt_identity())
    user = users_collection.find_one({'_id': user_id})
    if not user:
        return jsonify({'error': 'user_not_found'}), 404
    return jsonify(user_to_dict(user))

@app.route('/api/users/me', methods=['PUT'])
@jwt_required()
def update_current_user():
    user_id = str_to_objectid(get_jwt_identity())
    data = request.json or {}
    
    update_data = {}
    if 'username' in data:
        update_data['username'] = data['username'].strip()
    if 'email' in data:
        update_data['email'] = data['email'].strip().lower()
    if 'preferences' in data:
        update_data['preferences'] = data['preferences']
    
    if update_data:
        users_collection.update_one({'_id': user_id}, {'$set': update_data})
    
    user = users_collection.find_one({'_id': user_id})
    return jsonify(user_to_dict(user))

@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = str_to_objectid(get_jwt_identity())
    
    travels_count = travels_collection.count_documents({'user_id': user_id})
    
    # Get all travels for this user to count cities and photos
    travels = list(travels_collection.find({'user_id': user_id}))
    travel_ids = [t['_id'] for t in travels]
    
    cities_count = cities_collection.count_documents({'travel_id': {'$in': travel_ids}})
    
    # Count photos
    city_ids = [c['_id'] for c in cities_collection.find({'travel_id': {'$in': travel_ids}})]
    photos_count = photos_collection.count_documents({'city_id': {'$in': city_ids}})
    
    # Count notes
    notes_count = notes_collection.count_documents({'city_id': {'$in': city_ids}})
    
    # Count countries (distinct)
    countries = travels_collection.distinct('country', {'user_id': user_id})
    
    return jsonify({
        'travels': travels_count,
        'countries': len(countries),
        'cities': cities_count,
        'photos': photos_count,
        'notes': notes_count
    })

# ------------------------------------------------------------
# Travels
# ------------------------------------------------------------

@app.route('/api/travels', methods=['GET'])
@jwt_required()
def get_travels():
    user_id = str_to_objectid(get_jwt_identity())
    travels = travels_collection.find({'user_id': user_id}).sort('created_at', -1)
    return jsonify([travel_to_dict(t) for t in travels])

@app.route('/api/travels', methods=['POST'])
@jwt_required()
def create_travel():
    user_id = str_to_objectid(get_jwt_identity())
    data = request.json or {}

    country = (data.get('country') or '').strip()
    start_date = parse_date(data.get('start_date'))
    end_date = parse_date(data.get('end_date'))
    notes = data.get('notes', '')

    if not country or start_date is None or end_date is None:
        return jsonify({'error': 'missing_fields'}), 400

    # Center coordinates
    lat = data.get('latitude')
    lng = data.get('longitude')

    cities_payload = data.get('cities', []) or []
    valid_cities = []
    for c in cities_payload:
        name = (c.get('name') or '').strip()
        if not name:
            continue
        valid_cities.append({
            'name': name,
            'latitude': c.get('latitude'),
            'longitude': c.get('longitude'),
            'arrival_date': parse_date(c.get('arrival_date')),
            'departure_date': parse_date(c.get('departure_date')),
            'notes': c.get('notes', '')
        })

    # Calculate center if not provided
    if (lat is None or lng is None) and valid_cities:
        xs = [c['latitude'] for c in valid_cities if isinstance(c.get('latitude'), (int, float))]
        ys = [c['longitude'] for c in valid_cities if isinstance(c.get('longitude'), (int, float))]
        if xs and ys:
            lat = sum(xs) / len(xs)
            lng = sum(ys) / len(ys)

    if lat is None or lng is None:
        lat, lng = 0.0, 0.0

    # Create travel
    travel_doc = {
        'user_id': user_id,
        'country': country,
        'latitude': float(lat),
        'longitude': float(lng),
        'start_date': start_date,
        'end_date': end_date,
        'notes': notes,
        'created_at': datetime.utcnow()
    }
    
    travel_result = travels_collection.insert_one(travel_doc)
    travel_id = travel_result.inserted_id

    # Create cities
    for c in valid_cities:
        city_doc = {
            'travel_id': travel_id,
            'name': c['name'],
            'latitude': c.get('latitude'),
            'longitude': c.get('longitude'),
            'arrival_date': c.get('arrival_date'),
            'departure_date': c.get('departure_date'),
            'notes': c.get('notes', ''),
            'created_at': datetime.utcnow()
        }
        cities_collection.insert_one(city_doc)

    # Return complete travel data
    travel = travels_collection.find_one({'_id': travel_id})
    return jsonify(travel_to_dict(travel)), 201

@app.route('/api/travels/<travel_id>', methods=['GET'])
@jwt_required()
def get_travel(travel_id):
    user_id = str_to_objectid(get_jwt_identity())
    travel_obj_id = str_to_objectid(travel_id)
    
    if not travel_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    travel = travels_collection.find_one({'_id': travel_obj_id, 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    return jsonify(travel_to_dict(travel))

@app.route('/api/travels/<travel_id>', methods=['DELETE'])
@jwt_required()
def delete_travel(travel_id):
    user_id = str_to_objectid(get_jwt_identity())
    travel_obj_id = str_to_objectid(travel_id)
    
    if not travel_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    travel = travels_collection.find_one({'_id': travel_obj_id, 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    # Delete related data
    cities = list(cities_collection.find({'travel_id': travel_obj_id}))
    city_ids = [c['_id'] for c in cities]
    
    # Delete photos files and documents
    photos = list(photos_collection.find({'city_id': {'$in': city_ids}}))
    for photo in photos:
        try:
            path = os.path.join(app.config['UPLOAD_FOLDER'], photo['filename'])
            if os.path.exists(path):
                os.remove(path)
        except:
            pass
    
    photos_collection.delete_many({'city_id': {'$in': city_ids}})
    notes_collection.delete_many({'city_id': {'$in': city_ids}})
    cities_collection.delete_many({'travel_id': travel_obj_id})
    travels_collection.delete_one({'_id': travel_obj_id})

    return jsonify({'success': True})

# ------------------------------------------------------------
# Cities
# ------------------------------------------------------------

@app.route('/api/cities/<city_id>', methods=['GET'])
@jwt_required()
def get_city(city_id):
    user_id = str_to_objectid(get_jwt_identity())
    city_obj_id = str_to_objectid(city_id)
    
    if not city_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    city = cities_collection.find_one({'_id': city_obj_id})
    if not city:
        return jsonify({'error': 'not_found'}), 404
    
    # Verify ownership
    travel = travels_collection.find_one({'_id': city['travel_id'], 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    return jsonify({
        'id': objectid_to_str(city['_id']),
        'name': city['name'],
        'latitude': city.get('latitude'),
        'longitude': city.get('longitude'),
        'arrival_date': city.get('arrival_date'),
        'departure_date': city.get('departure_date'),
        'notes': city.get('notes', '')
    })

# ------------------------------------------------------------
# Photos
# ------------------------------------------------------------

@app.route('/api/cities/<city_id>/photos', methods=['POST'])
@jwt_required()
def upload_photo(city_id):
    user_id = str_to_objectid(get_jwt_identity())
    city_obj_id = str_to_objectid(city_id)
    
    if not city_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    city = cities_collection.find_one({'_id': city_obj_id})
    if not city:
        return jsonify({'error': 'not_found'}), 404
    
    # Verify ownership
    travel = travels_collection.find_one({'_id': city['travel_id'], 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    if 'photo' not in request.files:
        return jsonify({'error': 'no_file'}), 400

    file = request.files['photo']
    if file.filename == '':
        return jsonify({'error': 'empty_filename'}), 400
    if not allowed_image(file.filename):
        return jsonify({'error': 'unsupported_type'}), 415

    filename = secure_filename(f"{city_id}_{datetime.now().timestamp()}_{file.filename}")
    upload_dir = os.path.join(os.path.dirname(__file__), app.config['UPLOAD_FOLDER'])
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, filename)
    file.save(path)

    photo_doc = {
        'city_id': city_obj_id,
        'filename': filename,
        'caption': request.form.get('caption', ''),
        'created_at': datetime.utcnow()
    }
    
    result = photos_collection.insert_one(photo_doc)
    return jsonify({
        'id': objectid_to_str(result.inserted_id),
        'filename': filename,
        'caption': photo_doc['caption']
    }), 201

@app.route('/api/photos/<photo_id>/raw', methods=['GET'])
@jwt_required(optional=True)
def get_photo_raw(photo_id):
    photo_obj_id = str_to_objectid(photo_id)
    if not photo_obj_id:
        abort(404)
    
    photo = photos_collection.find_one({'_id': photo_obj_id})
    if not photo:
        abort(404)
    
    upload_dir = os.path.join(os.path.dirname(__file__), app.config['UPLOAD_FOLDER'])
    path = os.path.join(upload_dir, photo['filename'])
    if not os.path.exists(path):
        abort(404)
    
    return send_file(path)

@app.route('/api/photos/<photo_id>', methods=['DELETE'])
@jwt_required()
def delete_photo(photo_id):
    user_id = str_to_objectid(get_jwt_identity())
    photo_obj_id = str_to_objectid(photo_id)
    
    if not photo_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    photo = photos_collection.find_one({'_id': photo_obj_id})
    if not photo:
        return jsonify({'error': 'not_found'}), 404
    
    # Verify ownership
    city = cities_collection.find_one({'_id': photo['city_id']})
    if not city:
        return jsonify({'error': 'not_found'}), 404
    
    travel = travels_collection.find_one({'_id': city['travel_id'], 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    # Delete file
    try:
        upload_dir = os.path.join(os.path.dirname(__file__), app.config['UPLOAD_FOLDER'])
        path = os.path.join(upload_dir, photo['filename'])
        if os.path.exists(path):
            os.remove(path)
    except:
        pass

    photos_collection.delete_one({'_id': photo_obj_id})
    return jsonify({'success': True})

# ------------------------------------------------------------
# Notes
# ------------------------------------------------------------

@app.route('/api/cities/<city_id>/notes', methods=['POST'])
@jwt_required()
def create_note(city_id):
    user_id = str_to_objectid(get_jwt_identity())
    city_obj_id = str_to_objectid(city_id)
    
    if not city_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    city = cities_collection.find_one({'_id': city_obj_id})
    if not city:
        return jsonify({'error': 'not_found'}), 404
    
    # Verify ownership
    travel = travels_collection.find_one({'_id': city['travel_id'], 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    data = request.json or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'missing_content'}), 400

    note_doc = {
        'city_id': city_obj_id,
        'title': (data.get('title') or '').strip(),
        'content': content,
        'rating': int(data.get('rating', 0)) if data.get('rating') else None,  # 1-5 étoiles
        'category': (data.get('category') or '').strip(),  # restaurant, visite, hébergement, etc.
        'is_favorite': bool(data.get('is_favorite', False)),
        'tags': data.get('tags', []) if isinstance(data.get('tags'), list) else [],
        'created_at': datetime.utcnow()
    }
    
    result = notes_collection.insert_one(note_doc)
    return jsonify({
        'id': objectid_to_str(result.inserted_id),
        'title': note_doc['title'],
        'content': note_doc['content'],
        'created_at': note_doc['created_at']
    }), 201

@app.route('/api/notes/<note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    user_id = str_to_objectid(get_jwt_identity())
    note_obj_id = str_to_objectid(note_id)
    
    if not note_obj_id:
        return jsonify({'error': 'invalid_id'}), 400
    
    note = notes_collection.find_one({'_id': note_obj_id})
    if not note:
        return jsonify({'error': 'not_found'}), 404
    
    # Verify ownership
    city = cities_collection.find_one({'_id': note['city_id']})
    if not city:
        return jsonify({'error': 'not_found'}), 404
    
    travel = travels_collection.find_one({'_id': city['travel_id'], 'user_id': user_id})
    if not travel:
        return jsonify({'error': 'not_found'}), 404

    notes_collection.delete_one({'_id': note_obj_id})
    return jsonify({'success': True})

# ------------------------------------------------------------
# Health Check
# ------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health():
    try:
        # Test MongoDB connection
        db.command('ping')
        return jsonify({'status': 'ok', 'db': 'connected'})
    except:
        return jsonify({'status': 'error', 'db': 'disconnected'}), 500

# ------------------------------------------------------------
# Run
# ------------------------------------------------------------

if __name__ == '__main__':
    print("🚀 Starting Travel Tracker API with MongoDB...")
    print(f"📁 Upload folder: {app.config['UPLOAD_FOLDER']}")
    print(f"🗄️  MongoDB: {MONGODB_URI}")
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT', '5000')))