import React, { useRef } from 'react';
import {
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  uri: string | null;
  onClose: () => void;
}

export default function LightboxModal({ uri, onClose }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  const sv = useRef(1);   // current scale value
  const bx = useRef(0);   // base translate x (saved between gestures)
  const by = useRef(0);   // base translate y (saved between gestures)
  const gx = useRef(0);   // gesture start base x
  const gy = useRef(0);   // gesture start base y

  const pinchDist = useRef<number | null>(null);
  const pinchScale = useRef(1);
  const lastTap = useRef(0);

  const getTouchDist = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const springTo = (s: number, x = 0, y = 0) => {
    sv.current = s; bx.current = x; by.current = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true }),
      Animated.spring(tx, { toValue: x, useNativeDriver: true }),
      Animated.spring(ty, { toValue: y, useNativeDriver: true }),
    ]).start();
  };

  const pr = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        gx.current = bx.current;
        gy.current = by.current;
        if (touches.length >= 2) {
          pinchDist.current = getTouchDist(Array.from(touches));
          pinchScale.current = sv.current;
        }
      },

      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2 && pinchDist.current !== null) {
          const newDist = getTouchDist(Array.from(touches));
          const newScale = Math.max(1, Math.min(pinchScale.current * (newDist / pinchDist.current), 6));
          sv.current = newScale;
          scale.setValue(newScale);
        } else if (sv.current > 1) {
          const nx = gx.current + g.dx;
          const ny = gy.current + g.dy;
          bx.current = nx; by.current = ny;
          tx.setValue(nx); ty.setValue(ny);
        }
      },

      onPanResponderRelease: (evt, g) => {
        const remaining = evt.nativeEvent.touches.length;
        const wasPinch = pinchDist.current !== null;
        pinchDist.current = null;

        if (remaining > 0) return;

        if (wasPinch) {
          if (sv.current <= 1.05) springTo(1, 0, 0);
          return;
        }

        if (sv.current > 1) return;

        // Tap detection
        const isTap = Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8;
        if (!isTap) return;

        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          springTo(2.5);
        } else {
          lastTap.current = now;
          setTimeout(() => {
            if (Date.now() - lastTap.current >= 290) onClose();
          }, 300);
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => {
        scale.setValue(1); tx.setValue(0); ty.setValue(0);
        sv.current = 1; bx.current = 0; by.current = 0;
      }}
    >
      <View style={styles.backdrop} {...pr.panHandlers}>
        <Animated.View
          style={[styles.imgWrap, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
        >
          <Image source={{ uri: uri ?? '' }} style={styles.img} contentFit="contain" />
        </Animated.View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close-circle" size={34} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgWrap: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
  },
});
