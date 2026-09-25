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

export default function TermsOfServiceScreen() {
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
        title={isVi ? 'Điều khoản Dịch vụ' : 'Terms of Service'}
        subtitle={
          isVi
            ? 'Cập nhật lần cuối: 24/09/2026 • Ứng dụng Sổ vay nợ LOAN'
            : 'Last updated: September 24, 2026 • LOAN Shared Ledger App'
        }
      />

      {Platform.OS === 'web' && (
        <Notice>
          {isVi
            ? 'Điều khoản dịch vụ chính thức ràng buộc khi sử dụng ứng dụng di động LOAN và các dịch vụ trực tuyến liên quan.'
            : 'Official terms of service governing the usage of LOAN mobile application and online services.'}
        </Notice>
      )}

      {/* Core Disclaimer Card */}
      <Card>
        <Section>{isVi ? 'TUYÊN BỐ PHÁP LÝ QUAN TRỌNG' : 'IMPORTANT LEGAL DISCLAIMER'}</Section>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="document" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Sổ nợ đối soát 2 người' : 'Peer-to-Peer Ledger'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="lock" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Không giải ngân vốn' : 'No Capital Disbursement'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: p.soft, borderColor: p.primary }]}>
            <Icon name="check" size={16} color={p.primary} />
            <Text style={[styles.badgeText, { color: p.text }]}>
              {isVi ? 'Không phải tổ chức tín dụng' : 'Non-Financial Institution'}
            </Text>
          </View>
        </View>
        <Notice tone="warning">
          {isVi
            ? 'LOAN KHÔNG phải là ngân hàng, tổ chức tài chính tín dụng hay dịch vụ cho vay ngang hàng (P2P lending). Ứng dụng không cung cấp dịch vụ trung gian thanh toán và không thực hiện việc chuyển tiền thực tế.'
            : 'LOAN is NOT a bank, credit institution, or P2P lending intermediary. The app does not handle financial clearing or direct fund transfers between bank accounts.'}
        </Notice>
      </Card>

      {/* 1. Service Nature */}
      <Card>
        <Section>{isVi ? '1. BẢN CHẤT DỊCH VỤ' : '1. NATURE OF SERVICE'}</Section>
        <Label>
          {isVi
            ? '• LOAN là giải pháp công nghệ cung cấp sổ ghi chép chung giữa hai cá nhân để theo dõi các khoản vay nợ mượn cá nhân và lịch sử trả nợ.\n' +
              '• Dữ liệu trên ứng dụng mang tính chất đối soát, ghi nhận sự thống nhất giữa hai bên tham gia thông qua cơ chế lời mời (Invitation Link) và xác nhận 2 bên.'
            : '• LOAN is a shared bookkeeping tool allowing two individuals to collaboratively record personal loans, track repayments, and reconcile balances.\n' +
              '• Data within the app reflects bilateral agreement established through invitation links and two-party transaction confirmations.'}
        </Label>
      </Card>

      {/* 2. User Responsibilities */}
      <Card>
        <Section>{isVi ? '2. QUYỀN VÀ TRÁCH NHIỆM' : '2. RIGHTS & RESPONSIBILITIES'}</Section>
        <Label>
          {isVi
            ? '• Thỏa thuận dân sự: Mọi cam kết vay mượn, chuyển tiền thực tế hoặc lãi suất (nếu có do hai bên tự thỏa thuận ngoài ứng dụng) là trách nhiệm pháp lý độc lập giữa hai cá nhân.\n' +
              '• Xác nhận 2 chiều: Mọi giao dịch trả nợ chỉ được tính vào số dư khi người cho vay xác nhận đã nhận được tiền.\n' +
              '• Bảo mật tài khoản: Người dùng có trách nhiệm tự bảo vệ tài khoản Google và thiết bị của mình; Email OTP chưa bật trong production.'
            : '• Independent Agreements: Actual financial transactions, transfers, or agreements are sole civil responsibilities of the participating individuals.\n' +
              '• Dual Confirmation: Repayments only reduce the recorded balance once confirmed by the creditor.\n' +
              '• Account Security: Users are responsible for safeguarding their login credentials and devices.'}
        </Label>
      </Card>

      {/* 3. Account Deletion Rules */}
      <Card>
        <Section>{isVi ? '3. QUY TẮC XÓA TÀI KHOẢN' : '3. ACCOUNT DELETION POLICY'}</Section>
        <Notice tone="neutral">
          {isVi
            ? 'Để bảo vệ tính toàn vẹn của sổ sách tài chính và quyền đối soát của cả hai bên:\n\n' +
              '• Người dùng KHÔNG THỂ xóa tài khoản khi vẫn còn khoản vay đang hoạt động (ACTIVE) hoặc giao dịch trả nợ đang chờ xác nhận/tranh chấp.\n' +
              '• Bạn phải tất toán hoặc hủy bỏ toàn bộ các khoản vay trước khi thực hiện xóa tài khoản.'
            : 'To preserve ledger integrity and protect evidentiary rights for both parties:\n\n' +
              '• Users CANNOT delete their account while active loans (ACTIVE) or pending/disputed repayment records exist.\n' +
              '• All active loan rooms must be settled or closed prior to account deletion.'}
        </Notice>
      </Card>

      {/* 4. Limitation of Liability */}
      <Card>
        <Section>{isVi ? '4. GIỚI HẠN TRÁCH NHIỆM' : '4. LIMITATION OF LIABILITY'}</Section>
        <Label>
          {isVi
            ? 'Ứng dụng được cung cấp trên nguyên tắc "nguyên trạng" (as-is). Chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp hoặc gián tiếp nào phát sinh từ các tranh chấp nợ ngoài đời thực giữa các cá nhân tham gia.'
            : 'The application is provided "as is". We are not liable for direct or indirect losses arising from external personal disputes or failure of parties to fulfill their personal agreements.'}
        </Label>
      </Card>

      {/* 5. Contact & Navigation */}
      <Card>
        <Section>{isVi ? '5. LIÊN HỆ & ĐIỀU HƯỚNG' : '5. CONTACT & NAVIGATION'}</Section>
        <Label>
          {isVi
            ? 'Mọi thắc mắc về điều khoản dịch vụ, vui lòng liên hệ:\n' +
              '• Kênh hỗ trợ: duynguyenpc.280203@gmail.com\n' +
              '• Website chính thức: https://loan.duyhaohan.id.vn'
            : 'For inquiries regarding these terms, please contact:\n' +
              '• Support: duynguyenpc.280203@gmail.com\n' +
              '• Official Website: https://loan.duyhaohan.id.vn'}
        </Label>
        <View style={styles.btnRow}>
          <Button
            kind="quiet"
            icon="document"
            label={isVi ? 'Chính sách Quyền riêng tư' : 'Privacy Policy'}
            onPress={() => router.push('/privacy-policy' as never)}
          />
          <Button
            kind="quiet"
            label={isVi ? 'Yêu cầu Xóa tài khoản' : 'Request Account Deletion'}
            onPress={() => router.push('/account-deletion' as never)}
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
  btnRow: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
});
