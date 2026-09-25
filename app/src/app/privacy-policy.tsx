import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Brand,
  Button,
  Card,
  Icon,
  Label,
  Notice,
  PageHeader,
  Screen,
  Section,
  usePalette,
} from '@/components/loan-ui';

export default function PrivacyPolicyScreen() {
  const p = usePalette();
  const router = useRouter();
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<'vi' | 'en'>(i18n.language.startsWith('en') ? 'en' : 'vi');

  const isVi = lang === 'vi';

  return (
    <Screen>
      {/* Top Bar with Brand & Language Toggle */}
      <View style={styles.topBar}>
        <Brand />
        <View style={[styles.langToggle, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLang('vi')}
            style={[styles.langBtn, isVi && { backgroundColor: p.primary }]}
          >
            <Text style={[styles.langText, { color: isVi ? p.onPrimary : p.muted }]}>
              Tiếng Việt
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLang('en')}
            style={[styles.langBtn, !isVi && { backgroundColor: p.primary }]}
          >
            <Text style={[styles.langText, { color: !isVi ? p.onPrimary : p.muted }]}>English</Text>
          </Pressable>
        </View>
      </View>

      <PageHeader
        title={isVi ? 'Chính sách Quyền riêng tư' : 'Privacy Policy'}
        subtitle={
          isVi
            ? 'Cập nhật lần cuối: 24/09/2026 • Ứng dụng Sổ vay nợ LOAN'
            : 'Last updated: September 24, 2026 • LOAN Shared Ledger App'
        }
      />

      {Platform.OS === 'web' && (
        <Notice>
          {isVi
            ? 'Tài liệu công khai chính thức phục vụ người dùng và đối soát chính sách Google Play.'
            : 'Official public privacy disclosure for users and Google Play compliance review.'}
        </Notice>
      )}

      {/* Core Highlights Card */}
      <Card>
        <Section>{isVi ? 'CAM KẾT CỐT LÕI VỀ DỮ LIỆU' : 'CORE DATA COMMITMENTS'}</Section>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="lock" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Bảo mật RLS 2 chiều' : '2-Party RLS Isolation'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="check" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Không bán dữ liệu' : 'No Data Selling'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="check" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Mã hóa HTTPS / TLS' : 'HTTPS / TLS Encrypted'}
            </Text>
          </View>
        </View>
        <Label>
          {isVi
            ? 'LOAN là công cụ sổ ghi chép nợ chung giữa hai người, KHÔNG phải tổ chức tài chính, ngân hàng hay nền tảng cho vay tín dụng.'
            : 'LOAN is a peer-to-peer loan record-keeping tool, NOT a financial institution, bank, or credit lending platform.'}
        </Label>
      </Card>

      {/* What we collect */}
      <Card>
        <Section>{isVi ? '1. DỮ LIỆU THU THẬP' : '1. DATA WE COLLECT'}</Section>
        <Text style={[styles.itemHeading, { color: p.primary }]}>
          {isVi ? 'a. Tài khoản & Định danh' : 'a. Account & Identity'}
        </Text>
        <Label>
          {isVi
            ? '• Email: Thu thập khi đăng nhập bằng Google. Dùng để xác thực và nhận diện lời mời; Email OTP chưa bật trong production.\n• Tên & Ảnh đại diện: Giúp đối tác trong cùng khoản vay nhận biết người cùng ghi sổ.'
            : '• Email: Collected through Google Sign-In for authentication and invite recognition; email OTP is not enabled in production.\n• Display Name & Avatar: Helps your loan partner recognize who shares the record.'}
        </Label>

        <Text style={[styles.itemHeading, { color: p.primary, marginTop: 12 }]}>
          {isVi ? 'b. Thông tin ghi sổ khoản vay' : 'b. Ledger & Transaction Data'}
        </Text>
        <Label>
          {isVi
            ? '• Khoản vay: Số tiền, loại tiền, vai trò (người vay/người cho vay), ngày vay và ngày đến hạn.\n• Lịch sử trả nợ: Số tiền đã trả, ngày thanh toán, ghi chú và trạng thái xác nhận giữa 2 bên.\n• Nhật ký sự kiện: Thời điểm tạo, xác nhận hoặc hủy bỏ giao dịch.'
            : '• Loans: Principal amount, currency, roles (lender/borrower), issue date, and due date.\n• Repayments: Payment amounts, dates, notes, and dual-party confirmation states.\n• Audit logs: Timestamps for creation, confirmations, or cancellation events.'}
        </Label>

        <Text style={[styles.itemHeading, { color: p.primary, marginTop: 12 }]}>
          {isVi ? 'c. Thiết bị & Vận hành kỹ thuật' : 'c. Device & Technical Diagnostics'}
        </Text>
        <Label>
          {isVi
            ? '• Token thông báo đẩy: Bản production hiện tại tắt push và không đăng ký token thiết bị.\n• Nhật ký sự cố: Chỉ gửi khi Sentry DSN được cấu hình; event JavaScript được dựng theo allowlist và native collection đang tắt.'
            : '• Push notification token: The current production release disables push and does not register device tokens.\n• Crash logs: Sent only when a Sentry DSN is configured; JavaScript events use an allowlist and native collection is disabled.'}
        </Label>
      </Card>

      {/* What we DO NOT collect */}
      <Card>
        <Section>
          {isVi ? '2. DỮ LIỆU CHÚNG TÔI KHÔNG THU THẬP' : '2. DATA WE DO NOT COLLECT'}
        </Section>
        <Notice tone="neutral">
          {isVi
            ? 'Để bảo vệ tối đa quyền riêng tư, LOAN TUYỆT ĐỐI KHÔNG thu thập hoặc truy cập:\n\n' +
              '❌ Số thẻ ngân hàng, mã PIN hoặc CVV/CVC\n' +
              '❌ Danh bạ điện thoại (Contacts)\n' +
              '❌ Định vị vị trí chính xác hoặc ước tính (GPS Location)\n' +
              '❌ Microphone hoặc Camera\n' +
              '❌ Tin nhắn SMS hoặc nhật ký cuộc gọi'
            : 'To maximize your privacy, LOAN STRICTLY DOES NOT collect or access:\n\n' +
              '❌ Bank card numbers, PINs, or CVV/CVC codes\n' +
              '❌ Phone contacts or address books\n' +
              '❌ Precise or approximate GPS location\n' +
              '❌ Microphone or Camera access\n' +
              '❌ SMS messages or call logs'}
        </Notice>
      </Card>

      {/* How we use & protect data */}
      <Card>
        <Section>{isVi ? '3. MỤC ĐÍCH & BẢO MẬT' : '3. PURPOSE & SECURITY'}</Section>
        <Label>
          {isVi
            ? '1. Duy trì phiên đăng nhập và xác thực bảo mật.\n' +
              '2. Thiết lập phòng vay chung (Shared Room) đồng bộ dữ liệu thời gian thực giữa 2 người.\n' +
              '3. Phân quyền Row Level Security (RLS): Chỉ 2 người tham gia mới có quyền truy cập dữ liệu khoản vay đó.\n' +
              '4. Cam kết: KHÔNG bán, cho thuê hoặc chia sẻ dữ liệu cho bên thứ ba vì mục đích quảng cáo.'
            : '1. Maintain secure authenticated sessions.\n' +
              '2. Power shared loan rooms with real-time sync strictly between the two participants.\n' +
              '3. Row Level Security (RLS): Only authenticated participants can access their loan data.\n' +
              '4. Commitment: We NEVER sell, rent, or share personal data with third parties for advertising.'}
        </Label>
      </Card>

      {/* Account Deletion & Rights */}
      <Card>
        <Section>{isVi ? '4. QUYỀN XÓA TÀI KHOẢN' : '4. ACCOUNT DELETION RIGHTS'}</Section>
        <Label>
          {isVi
            ? 'Bạn có toàn quyền yêu cầu xóa tài khoản và dữ liệu cá nhân bất kỳ lúc nào.\n\n' +
              '• Điều kiện: Bạn cần hoàn tất hoặc đóng toàn bộ các khoản vay đang hoạt động trước khi xóa để bảo vệ quyền lợi đối soát của cả hai bên.\n' +
              '• Email, tên, token và các trường văn bản tự do trong lịch sử liên quan sẽ bị xóa. Số tiền, ngày và trạng thái đã tất toán được giữ ở dạng vô danh cho đối tác. Audit kỹ thuật được giữ tối đa 180 ngày.'
            : 'You have full rights to delete your account and personal data at any time.\n\n' +
              '• Requirement: You must settle or close all active loans prior to deletion to protect ledger integrity for both participants.\n' +
              '• Email, name, device tokens and related free-text fields are removed. Settled amounts, dates and states remain anonymized for the other participant. Technical deletion audit is retained for up to 180 days.'}
        </Label>
        <Button
          kind="secondary"
          label={isVi ? 'Đi đến Cổng Xóa Tài Khoản' : 'Go to Account Deletion Portal'}
          onPress={() => router.push('/account-deletion' as never)}
        />
      </Card>

      {/* Contact & Navigation */}
      <Card>
        <Section>{isVi ? '5. THÔNG TIN LIÊN HỆ & PHÁP LÝ' : '5. CONTACT & LEGAL'}</Section>
        <Label>
          {isVi
            ? 'Mọi câu hỏi về chính sách quyền riêng tư, vui lòng liên hệ:\n' +
              '• Đơn vị phát triển: Nhóm phát triển LOAN\n' +
              '• Tên miền chính thức: https://loan.duyhaohan.id.vn\n' +
              '• Kênh hỗ trợ: duynguyenpc.280203@gmail.com'
            : 'For privacy inquiries, please contact:\n' +
              '• Developer: LOAN Development Team\n' +
              '• Official Domain: https://loan.duyhaohan.id.vn\n' +
              '• Support: duynguyenpc.280203@gmail.com'}
        </Label>
        <View style={styles.btnRow}>
          <Button
            kind="quiet"
            icon="document"
            label={isVi ? 'Điều khoản dịch vụ' : 'Terms of Service'}
            onPress={() => router.push('/terms' as never)}
          />
          <Button
            kind="primary"
            icon="back"
            label={isVi ? 'Quay lại' : 'Back'}
            onPress={() => router.back()}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
});
