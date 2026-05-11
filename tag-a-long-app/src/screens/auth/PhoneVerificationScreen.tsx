// Phone Verification Screen
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../types';
import { authAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PhoneVerification'>;
  route: RouteProp<AuthStackParamList, 'PhoneVerification'>;
};

export default function PhoneVerificationScreen({ navigation, route }: Props) {
  const { signupData } = route.params;
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { signup } = useAuthStore();

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      await signup({ ...signupData, otp_code: otp });
      navigation.navigate('ProfileSetup');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Verification failed';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setIsResending(true);
      await authAPI.sendPhoneOtp(signupData.phone);
      Alert.alert('Sent', 'A new code has been sent to your phone.');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message || 'Could not resend code';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Verify Your Number</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phone}>{signupData.phone}</Text>
        </Text>

        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor="#ccc"
          value={otp}
          onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.verifyButton, (isLoading || otp.length !== 6) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading || otp.length !== 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify & Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={isResending} style={styles.resendButton}>
          {isResending ? (
            <ActivityIndicator color="#E8572A" size="small" />
          ) : (
            <Text style={styles.resendText}>Didn't get a code? <Text style={styles.resendLink}>Resend</Text></Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 40,
  },
  backText: {
    fontSize: 16,
    color: '#E8572A',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E8572A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 40,
  },
  phone: {
    fontWeight: '600',
    color: '#333',
  },
  otpInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 18,
    fontSize: 28,
    letterSpacing: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 24,
  },
  verifyButton: {
    backgroundColor: '#E8572A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    padding: 10,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    color: '#E8572A',
    fontWeight: '600',
  },
});
