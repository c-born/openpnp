import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.File;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.openpnp.gui.importer.KicadModImporter;
import org.openpnp.model.Footprint.Pad;

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
    }
}
