# Video Processing API

This Node.js application provides a RESTful API for video upload, trimming, concatenation, and sharing with time-based expiry links. It leverages FFmpeg for video processing and SQLite for data storage.

## Features

- **User Authentication**: Secure user authentication using JWT.
- **Video Upload**: Upload videos with configurable size and duration limits.
- **Video Trimming**: Trim videos to specified start and end times.
- **Video Concatenation**: Concatenate multiple videos into a single video.
- **Database**: Uses SQLite for data storage.

## Prerequisites

Ensure you have the following installed before starting:

- **Node.js**: Version 14 or higher.
- **npm**: Node Package Manager.
- **FFmpeg**: Installed on your system.
- **SQLite**: Installed on your system.

## Installation

Follow these steps to set up the project:

1. **Clone the Repository**:
    - Using SSH: `git clone git@github.com:your-username/video-processing-api.git`
    - Using HTTPS: `git clone https://github.com/your-username/video-processing-api.git`
    - Alternatively, download the repository as a ZIP file and extract it.

2. **Navigate to the Project Directory**:
    ```sh
    cd video-processing-api
    ```

3. **Install Dependencies**:
    ```sh
    npm install
    ```

4. **Set Up Environment Variables**:
    - Create a `.env` file in the root directory and add the following:
      ```env
      JWT_SECRET_KEY=your_secret_key_here
      ```

5. **Install Nodemon (Optional)**:
    - For easier development, install Nodemon:
      ```sh
      npm install -g nodemon
      ```

## Usage

1. **Start the Server**:
    - Use Nodemon for development:
      ```sh
      nodemon index.js
      ```
    - Or use Node.js directly:
      ```sh
      node index.js
      ```

2. **Access the API**:
    - The API will be available at `http://localhost:3000`.

## API Endpoints

### Authentication

- **Sign Up**: `POST /api/auth/signup`
    - Create a new user account.
- **Log In**: `POST /api/auth/login`
    - Log in and receive a JWT.

### Video Processing

All video processing endpoints require authentication. Include the JWT in the Authorization header.

- **Upload Video**: `POST /api/videos/upload`
    - Upload a video file.
- **Trim Video**: `POST /api/videos/trim`
    - Trim a video to specified start and end times.
- **Concatenate Videos**: `POST /api/videos/concatenate`
    - Concatenate multiple videos into a single video.

## Workflow

1. **Sign Up**:
    - Create an account using a username and password.

2. **Log In**:
    - Log in with the same username and password to receive an accessToken.

3. **Authorization**:
    - Include the accessToken in the Authorization header as a Bearer Token for subsequent requests.

4. **Upload Video**:
    - Upload a video using form-data or binary.

5. **Trim Video**:
    - Provide the videoId, start, and end times to trim the video.

6. **Concatenate Videos**:
    - Provide the videoIds to concatenate multiple videos.

## Error Handling

The API uses standard HTTP status codes for error responses. Check the response body for detailed error messages.

## Assumptions and Design Choices

1. **Authentication**: JWT is used for stateless authentication to improve scalability.
2. **Video Processing**: FFmpeg is chosen for its robustness and wide format support.
3. **Database**: SQLite is used for simplicity and ease of setup. For production, consider using a more robust database like PostgreSQL.
4. **Link Expiry**: Random tokens are generated for sharing links, with expiry times stored in the database. A background job periodically cleans up expired links.
5. **File Storage**: Videos are stored in the local filesystem. For production, consider using cloud storage solutions.
6. **Error Handling**: Centralized error handling middleware ensures consistent error responses across the API.

## Code Quality and Structure

- **MVC Pattern**: The project follows the Model-View-Controller pattern for clear separation of concerns.
- **Middleware**: Used for authentication and request validation.
- **Services**: Encapsulate business logic.
- **Repositories**: Abstract database operations.
- **Centralized Error Handling**: Ensures consistent error responses.
