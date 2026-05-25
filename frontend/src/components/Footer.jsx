import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

const Footer = () => {
  const footerLinks = {
    company: [
      { name: "Về chúng tôi", href: "/about" },
      { name: "Tuyển dụng", href: "/careers" },
      { name: "Báo chí", href: "/press" },
      { name: "Blog", href: "/blog" },
    ],
    support: [
      { name: "Trung tâm trợ giúp", href: "/help" },
      { name: "Thông tin an toàn", href: "/safety" },
      { name: "Chính sách hủy đặt phòng", href: "/cancellation" },
      { name: "Liên hệ hỗ trợ", href: "/contact" },
    ],
    hosting: [
      { name: "Đăng khách sạn của bạn", href: "/host" },
      { name: "Tài nguyên đối tác", href: "/host/resources" },
      { name: "Cộng đồng đối tác", href: "/community" },
      {
        name: "Kinh doanh lưu trú có trách nhiệm",
        href: "/responsible-hosting",
      },
    ],
    legal: [
      { name: "Chính sách bảo mật", href: "/privacy" },
      { name: "Điều khoản dịch vụ", href: "/terms" },
      { name: "Chính sách cookie", href: "/cookies" },
      { name: "Sơ đồ trang", href: "/sitemap" },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
    { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
    { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
    { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#FF385C] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <span className="text-xl font-semibold text-white font-[Poppins]">
                HotelBooking
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Tìm và đặt khách sạn phù hợp cho chuyến đi tiếp theo của bạn. Được
              hàng triệu du khách tin dùng.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 bg-gray-800 hover:bg-[#FF385C] rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Công ty</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold mb-4">Hỗ trợ</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Hosting */}
          <div>
            <h4 className="text-white font-semibold mb-4">Đối tác lưu trú</h4>
            <ul className="space-y-2">
              {footerLinks.hosting.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Liên hệ</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin
                  size={18}
                  className="text-[#FF385C] mt-0.5 flex-shrink-0"
                />
                <span className="text-gray-400 text-sm">
                  123 Đường Du Lịch, Phường Bạch Mai, Hà Nội
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-[#FF385C] flex-shrink-0" />
                <a
                  href="tel:19001234"
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  1900 1234
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-[#FF385C] flex-shrink-0" />
                <a
                  href="mailto:hello@hotelbooking.com"
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  hello@hotelbooking.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2026 HotelBooking. Bảo lưu mọi quyền.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {footerLinks.legal.map((link, index) => (
                <span key={link.name} className="flex items-center gap-4">
                  <a
                    href={link.href}
                    className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {link.name}
                  </a>
                  {index < footerLinks.legal.length - 1 && (
                    <span className="text-gray-700">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
