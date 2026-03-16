import cv2
import sys
import os

input_path = sys.argv[1] if len(sys.argv) > 1 else "Screen Recording 2026-03-16 at 09.32.21.mov"

if not os.path.isfile(input_path):
    print(f"Error: file not found: {input_path}")
    sys.exit(1)

video = cv2.VideoCapture(input_path)
if not video.isOpened():
    print(f"Error: could not open video: {input_path}")
    sys.exit(1)

fps = video.get(cv2.CAP_PROP_FPS)
width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

name, ext = os.path.splitext(os.path.basename(input_path))
output_path = f"{name}_tracked.mp4"

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

print(f"Input:  {input_path} ({width}x{height}, {fps:.1f} fps, {total_frames} frames)")
print(f"Output: {output_path}")

frame_num = 0
faces_found = 0

while True:
    ret, frame = video.read()
    if not ret:
        break

    frame_num += 1
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        faces_found += 1

    writer.write(frame)

    if frame_num % 30 == 0 or frame_num == total_frames:
        pct = frame_num / total_frames * 100 if total_frames > 0 else 0
        print(f"  Processed {frame_num}/{total_frames} frames ({pct:.0f}%) — {len(faces)} face(s) in current frame")

video.release()
writer.release()

print(f"\nDone! {frame_num} frames processed, {faces_found} total face detections.")
print(f"Saved to: {output_path}")
