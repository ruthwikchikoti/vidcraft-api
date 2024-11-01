const ffmpeg = require('fluent-ffmpeg');
const { db, userDb } = require('../config/database');
const moment = require('moment');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const generateTempLink = (videoId, expiryMinutes = 60) => {
  const token = crypto.randomBytes(20).toString('hex');
  const expiryTime = new Date(Date.now() + expiryMinutes * 60000);
  
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO temp_links (video_id, token, expiry_time) VALUES (?, ?, ?)', 
        [videoId, token, expiryTime.toISOString()], (err) => {
        if (err) {
            console.error('Error saving temp link:', err);
            reject(err);
        } else {
            resolve(`https://your-domain.com/video/${token}`);
        }
    });
  });
};

exports.uploadVideo = (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  const authToken = req.headers.authorization;
  const accessToken = authToken.split(' ')[1];
  userDb.get('SELECT * FROM users WHERE accessToken = ?', [accessToken], (err, row) => {
    console.log(accessToken);
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error querying database');
    }

    if (!row) {
      return res.status(401).send('Unauthorized');
    }
  });

  const { path: videoPath, filename, originalname } = req.file;

  
  ffmpeg.ffprobe(videoPath, (err, metadata) => {

    if (err) {
      console.error('FFprobe error:', err);
      return res.status(500).send('Error processing video');
    }

    const duration = metadata.format.duration;

    db.get('SELECT id FROM videos WHERE originalname = ?', [originalname], (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error querying database');
      }

      if (row) {
        generateTempLink(row.id)
          .then(tempLink => {
            res.status(200).json({
              message: 'Video already exists',
              videoId: row.id,
              path: videoPath,
              tempLink: tempLink
            });
          })
          .catch(err => {
            console.error('Error generating temp link:', err);
            res.status(500).send('Error generating temporary link');
          });
      } else {
        db.run('INSERT INTO videos (filename, path, duration, originalname) VALUES (?, ?, ?, ?)',
          [filename, videoPath, duration, originalname], function (err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).send('Error saving to database');
            }

            generateTempLink(this.lastID)
              .then(tempLink => {
                res.status(200).json({
                  message: 'Video uploaded successfully',
                  videoId: this.lastID,
                  tempLink: tempLink
                });
              })
              .catch(err => {
                console.error('Error generating temp link:', err);
                res.status(500).send('Error generating temporary link');
              });
          });
      }
    });
  });
};

exports.trimVideo = (req, res) => {
  const { videoId, start, end } = req.body;
  console.log("Trimming request received:", { videoId, start, end });

  if (!videoId || !start || !end) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const startSeconds = moment.duration(start).asSeconds();
  const endSeconds = moment.duration(end).asSeconds();

  if (isNaN(startSeconds) || isNaN(endSeconds) || startSeconds >= endSeconds) {
    return res.status(400).json({ message: 'Invalid start or end time' });
  }

  trimVideo2(videoId, startSeconds, endSeconds, res);
};

const trimVideo2 = (videoId, startSeconds, endSeconds, res) => {
  db.get('SELECT path FROM videos WHERE id = ?', [videoId], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Error querying database' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const inputPath = row.path;
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ message: 'Input video file not found' });
    }

    const outputPath = path.join('uploads', `trimmed_${Date.now()}_id${videoId}.mp4`);

    console.log('Starting ffmpeg process');
    console.log('Input path:', inputPath);
    console.log('Output path:', outputPath);
    console.log('Start time:', startSeconds);
    console.log('End time:', endSeconds);

    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(endSeconds - startSeconds)
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-preset ultrafast',
        '-movflags +faststart',
        '-max_muxing_queue_size 9999'
      ])
      .output(outputPath)
      .on('start', (command) => {
        console.log('ffmpeg process started:', command);
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + progress.percent + '% done');
      })
      .on('end', () => {
        console.log('Video trimming completed');
        db.run('INSERT INTO videos (filename, path, duration) VALUES (?, ?, ?)',
          [path.basename(outputPath), outputPath, endSeconds - startSeconds], function (err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).send('Error saving trimmed video to database');
            }

            generateTempLink(this.lastID)
              .then(tempLink => {
                res.status(200).json({
                  message: 'Video trimmed successfully',
                  trimmedVideoPath: outputPath,
                  tempLink: tempLink
                });
              })
              .catch(err => {
                console.error('Error generating temp link:', err);
                res.status(500).send('Error generating temporary link');
              });
          });
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        res.status(500).json({
          message: 'Error trimming video',
          error: err.message
        });
      })
      .run();
  });
};

exports.concatenateVideos = (req, res) => {
  const { videoIds } = req.body;

  db.all('SELECT path FROM videos WHERE id IN (' + videoIds.join(',') + ')', [], (err, rows) => {
      if (err || rows.length !== videoIds.length) {
          return res.status(404).send('One or more videos not found');
      }

      const inputPaths = rows.map(row => row.path);
      const outputPath = path.join('uploads', `concatenated_${Date.now()}.mp4`);
      const tempDir = path.join('uploads', 'temp');

      if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
      }

      const standardizationPromises = inputPaths.map((inputPath, index) => {
          return new Promise((resolve, reject) => {
              const standardizedPath = path.join(tempDir, `standardized_${index}.mp4`);
              ffmpeg(inputPath)
                  .outputOptions([
                      '-vf', 'scale=1280:720,fps=24',
                      '-c:v', 'libx264',
                      '-c:a', 'aac',
                      '-ar', '44100',
                      '-strict', 'experimental'
                  ])
                  .output(standardizedPath)
                  .on('end', () => resolve(standardizedPath))
                  .on('error', reject)
                  .run();
          });
      });

      Promise.all(standardizationPromises)
          .then(standardizedPaths => {
              const command = ffmpeg();
              standardizedPaths.forEach(path => {
                  command.input(path);
              });

              command
                  .on('start', (commandLine) => {
                      console.log('Spawned FFmpeg with command: ' + commandLine);
                  })
                  .on('error', (err, stdout, stderr) => {
                      console.error('FFmpeg error:', err);
                      console.error('FFmpeg stdout:', stdout);
                      console.error('FFmpeg stderr:', stderr);
                      res.status(500).json({
                          message: 'Error concatenating videos',
                          error: err.message
                      });
                  })
                  .on('end', () => {
                      console.log('Concatenation finished');
                      standardizedPaths.forEach(fs.unlinkSync);
                      
                      db.run('INSERT INTO videos (filename, path) VALUES (?, ?)',
                        [path.basename(outputPath), outputPath], function (err) {
                          if (err) {
                            console.error('Database error:', err);
                            return res.status(500).send('Error saving concatenated video to database');
                          }

                          generateTempLink(this.lastID)
                            .then(tempLink => {
                              res.status(200).json({
                                message: 'Videos concatenated successfully',
                                outputPath: outputPath,
                                tempLink: tempLink
                              });
                            })
                            .catch(err => {
                              console.error('Error generating temp link:', err);
                              res.status(500).send('Error generating temporary link');
                            });
                        });
                  })
                  .mergeToFile(outputPath, tempDir);
          })
          .catch(err => {
              console.error('Error in video standardization:', err);
              res.status(500).json({
                  message: 'Error standardizing videos',
                  error: err.message
              });
          });
  });
};

exports.serveVideo = (req, res) => {
  const { token } = req.params;
  
  db.get('SELECT video_id, expiry_time FROM temp_links WHERE token = ?', [token], (err, row) => {
      if (err) {
          console.error('Database error:', err);
          return res.status(500).send('Error querying database');
      }
      
      if (!row) {
          return res.status(404).send('Invalid or expired link');
      }
      
      if (new Date(row.expiry_time) < new Date()) {
          return res.status(410).send('Link has expired');
      }
      
      db.get('SELECT path FROM videos WHERE id = ?', [row.video_id], (err, videoRow) => {
          if (err || !videoRow) {
              return res.status(404).send('Video not found');
          }
          
          const videoPath = videoRow.path;
          const stat = fs.statSync(videoPath);
          const fileSize = stat.size;
          const range = req.headers.range;

          if (range) {
              const parts = range.replace(/bytes=/, "").split("-");
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
              const chunksize = (end-start)+1;
              const file = fs.createReadStream(videoPath, {start, end});
              const head = {
                  'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': chunksize,
                  'Content-Type': 'video/mp4',
              };
              res.writeHead(206, head);
              file.pipe(res);
          } else {
              const head = {
                  'Content-Length': fileSize,
                  'Content-Type': 'video/mp4',
              };
              res.writeHead(200, head);
              fs.createReadStream(videoPath).pipe(res);
          }
      });
  });
};