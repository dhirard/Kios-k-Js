import java.io.ByteArrayInputStream;
import javax.print.*;
import javax.print.attribute.*;
import javax.print.attribute.standard.Copies;

public class ThermalPrinter {
    public static void main(String[] args) {
        try {
            // Nama printer (sesuaikan dengan nama printer thermal di sistem Anda)
            String printerName = "POS58 Printer"; // ganti sesuai nama printer Anda

            // Cari printer berdasarkan nama
            PrintService[] services = PrintServiceLookup.lookupPrintServices(null, null);
            PrintService thermalPrinter = null;

            for (PrintService service : services) {
                if (service.getName().equalsIgnoreCase(printerName)) {
                    thermalPrinter = service;
                    break;
                }
            }

            if (thermalPrinter == null) {
                System.out.println("Printer tidak ditemukan!");
                return;
            }

            // Isi struk (lebar 58mm biasanya muat ±32 karakter per baris)
            StringBuilder sb = new StringBuilder();
            sb.append(center("TOKO BUNGA ARDI")).append("\n");
            sb.append(center("Jl. Mawar No. 123")).append("\n");
            sb.append("--------------------------------\n");
            sb.append(String.format("%-20s %5s %6s\n", "Bucket Roses", "1x", "Rp50k"));
            sb.append(String.format("%-20s %5s %6s\n", "Lily White", "2x", "Rp70k"));
            sb.append("--------------------------------\n");
            sb.append(String.format("%-20s %11s\n", "TOTAL", "Rp120k"));
            sb.append("\n");
            sb.append(center("Terima Kasih")).append("\n\n\n\n");

            // Konversi string ke input stream
            byte[] bytes = sb.toString().getBytes("CP437"); // ESC/POS biasanya pakai CP437/ASCII
            ByteArrayInputStream bais = new ByteArrayInputStream(bytes);

            // Siapkan dokumen untuk dicetak
            DocFlavor flavor = DocFlavor.INPUT_STREAM.AUTOSENSE;
            Doc doc = new SimpleDoc(bais, flavor, null);

            // Atur attribute cetak
            PrintRequestAttributeSet attrs = new HashPrintRequestAttributeSet();
            attrs.add(new Copies(1));

            // Kirim ke printer
            DocPrintJob job = thermalPrinter.createPrintJob();
            job.print(doc, attrs);

            System.out.println("Struk berhasil dicetak!");

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Helper untuk center text (agar rata tengah di kertas 58mm)
    public static String center(String text) {
        int width = 32; // jumlah karakter per baris untuk kertas 58mm
        int padSize = (width - text.length()) / 2;
        if (padSize <= 0) return text;
        String pad = " ".repeat(padSize);
        return pad + text;
    }
}
