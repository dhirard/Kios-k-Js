const escpos = require("escpos");
escpos.USB = require("escpos-usb");

const device = new escpos.USB();
const printer = new escpos.Printer(device);

device.open(() => {
  printer.align("CT").text("Hello World dari Node ESC/POS").cut().close();
});
