package org.openpnp.vision.pipeline.stages;

import org.opencv.core.Mat;
import org.opencv.core.MatOfPoint;
import org.opencv.core.Point;
import org.opencv.core.Scalar;
import org.opencv.imgproc.Imgproc;
import org.opencv.objdetect.QRCodeDetector;
import org.openpnp.vision.pipeline.CvPipeline;
import org.openpnp.vision.pipeline.CvStage;
import org.openpnp.vision.pipeline.Stage;

/**
 * Detects and decodes a QR code in the working image using the OpenCV QRCodeDetector.
 * Returns a {@link SimpleOcr.OcrModel} so it can be used as a drop-in replacement for
 * SimpleOcr (barcode mode) in the BlindsFeeder pipeline.
 *
 * <p>Unlike the ZXing-based barcode mode in SimpleOcr, the OpenCV detector is scale- and
 * rotation-independent and does not rely on a fixed block-grid binarizer, making it
 * significantly more robust across different slot positions and feeder orientations.</p>
 */
@Stage(category = "Detection",
        description = "Detects and decodes a QR code in the working image using the OpenCV "
                + "QRCodeDetector. Returns an OcrModel compatible with BlindsFeeder OCR. "
                + "More robust than SimpleOcr barcode mode because it is scale- and "
                + "rotation-independent.")
public class DetectQrCode extends CvStage {

    @Override
    public Result process(CvPipeline pipeline) throws Exception {
        Mat mat = pipeline.getWorkingImage();

        // QRCodeDetector requires grayscale. Convert if the working image is multi-channel.
        Mat gray = new Mat();
        if (mat.channels() > 1) {
            Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY);
        }
        else {
            mat.copyTo(gray);
        }

        // Pass a clone to the detector: detectAndDecode may modify the input Mat
        // internally, which would corrupt gray and produce inconsistent results on
        // repeated calls.
        Mat input = gray.clone();
        Mat points = new Mat();
        String decoded;
        try {
            decoded = new QRCodeDetector().detectAndDecode(input, points);
        }
        finally {
            input.release();
        }

        if (decoded == null || decoded.isEmpty()) {
            points.release();
            return new Result(gray, new SimpleOcr.OcrModel("", 0, 0.0));
        }

        // Convert back to BGR so the outline is visible in colour in the pipeline editor.
        Mat display = new Mat();
        Imgproc.cvtColor(gray, display, Imgproc.COLOR_GRAY2BGR);
        gray.release();

        if (!points.empty()) {
            // points is a 1×4 Mat of CV_32FC2 — draw the QR outline.
            Point[] corners = new Point[4];
            for (int i = 0; i < 4; i++) {
                corners[i] = new Point(points.get(0, i)[0], points.get(0, i)[1]);
            }
            MatOfPoint poly = new MatOfPoint(corners);
            Imgproc.polylines(display, java.util.Collections.singletonList(poly),
                    true, new Scalar(0, 255, 0), 3);
        }
        points.release();

        return new Result(display, new SimpleOcr.OcrModel(decoded, decoded.length(), decoded.length()));
    }
}
