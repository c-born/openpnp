import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.File;
import java.io.StringReader;
import java.awt.geom.Rectangle2D;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.openpnp.gui.importer.KicadModImporter;
import org.openpnp.model.Footprint;
import org.openpnp.model.Footprint.Pad;
import org.openpnp.util.XmlSerialize;
import org.simpleframework.xml.Serializer;

public class KicadModImporterTest {
    @Test
    public void testKicad9MultilinePads() throws Exception {
        KicadModImporter importer = new KicadModImporter(new File("samples", "G120_1V1.kicad_mod"));
        List<Pad> pads = importer.getPads();

        assertEquals(91, pads.size());
        assertEquals("1", pads.get(0).getName());
        assertEquals(-12.7, pads.get(0).getX(), 0.0001);
        assertEquals(16.51, pads.get(0).getY(), 0.0001);
        assertEquals(1.524, pads.get(0).getWidth(), 0.0001);
        assertEquals(0.889, pads.get(0).getHeight(), 0.0001);
        assertEquals(0, pads.get(0).getRotation(), 0.0001);

        assertEquals("28", pads.get(27).getName());
        assertEquals(90, pads.get(27).getRotation(), 0.0001);

        Footprint footprint = new Footprint();
        for (Pad pad : pads) {
            footprint.addPad(pad);
        }
        footprint.setBodyFromPads();

        assertEquals(28.194, footprint.getBodyWidth(), 0.0001);
        assertEquals(39.624, footprint.getBodyHeight(), 0.0001);
        assertEquals(0.635, footprint.getBodyX(), 0.0001);

        Rectangle2D padsBounds = footprint.getPadsShape().getBounds2D();
        Rectangle2D bodyBounds = footprint.getBodyShape().getBounds2D();
        assertEquals(padsBounds.getMinX(), bodyBounds.getMinX(), 0.0001);
        assertEquals(padsBounds.getMaxX(), bodyBounds.getMaxX(), 0.0001);
        assertEquals(padsBounds.getMinY(), bodyBounds.getMinY(), 0.0001);
        assertEquals(padsBounds.getMaxY(), bodyBounds.getMaxY(), 0.0001);
    }

    @Test
    public void testMissingBodyOffsetDefaultsToZero() throws Exception {
        Serializer serializer = XmlSerialize.createSerializer();
        Footprint footprint = serializer.read(Footprint.class, new StringReader(
                "<footprint units=\"Millimeters\" bodyWidth=\"1.0\" bodyHeight=\"2.0\"/>"));

        assertEquals(0, footprint.getBodyX(), 0.0001);
        assertEquals(0, footprint.getBodyY(), 0.0001);
    }
}
