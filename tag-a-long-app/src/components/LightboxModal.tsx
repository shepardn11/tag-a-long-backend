import React, { useRef } from 'react';
import {
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  View,
  Animated,
  Easing,
} from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  uri: string | null;
  onClose: () => void;
}

export default function LightboxModal({ uri, onClose }: Props) {
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);
  const doubleTapRef = useRef<TapGestureHandler>(null);

  // Scale: baseScale * pinchScale = displayed scale
  const baseScaleAnim = useRef(new Animated.Value(1)).current;
  const pinchScaleAnim = useRef(new Animated.Value(1)).current;
  const totalScale = useRef(Animated.multiply(baseScaleAnim, pinchScaleAnim)).current;
  const committedScale = useRef(1);

  // Translation: baseTx + panTx = displayed tx
  const baseTxAnim = useRef(new Animated.Value(0)).current;
  const panTxAnim = useRef(new Animated.Value(0)).current;
  const totalTx = useRef(Animated.add(baseTxAnim, panTxAnim)).current;
  const baseTyAnim = useRef(new Animated.Value(0)).current;
  const panTyAnim = useRef(new Animated.Value(0)).current;
  const totalTy = useRef(Animated.add(baseTyAnim, panTyAnim)).current;
  const committedTx = useRef(0);
  const committedTy = useRef(0);

  const maxPan = (s: number) => Math.max(0, (SCREEN_W * (s - 1)) / 2);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const resetAll = (animated = true) => {
    committedScale.current = 1;
    committedTx.current = 0;
    committedTy.current = 0;
    pinchScaleAnim.setValue(1);
    panTxAnim.setValue(0);
    panTyAnim.setValue(0);
    if (animated) {
      Animated.parallel([
        Animated.spring(baseScaleAnim, { toValue: 1, useNativeDriver: true, overshootClamping: true, tension: 100, friction: 10 }),
        Animated.spring(baseTxAnim, { toValue: 0, useNativeDriver: true, overshootClamping: true }),
        Animated.spring(baseTyAnim, { toValue: 0, useNativeDriver: true, overshootClamping: true }),
      ]).start();
    } else {
      baseScaleAnim.setValue(1);
      baseTxAnim.setValue(0);
      baseTyAnim.setValue(0);
    }
  };

  // --- Pinch ---
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScaleAnim } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = ({ nativeEvent: e }: any) => {
    if (e.oldState === State.ACTIVE) {
      const newScale = clamp(committedScale.current * e.scale, 1, 6);
      committedScale.current = newScale;
      baseScaleAnim.setValue(newScale);
      pinchScaleAnim.setValue(1);
      if (newScale <= 1.05) resetAll(true);
    }
  };

  // --- Pan ---
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panTxAnim, translationY: panTyAnim } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = ({ nativeEvent: e }: any) => {
    if (e.state === State.BEGAN) {
      panTxAnim.setValue(0);
      panTyAnim.setValue(0);
    }
    if (e.oldState === State.ACTIVE) {
      const maxP = maxPan(committedScale.current);
      const curTx = committedTx.current + e.translationX;
      const curTy = committedTy.current + e.translationY;
      const finalTx = clamp(curTx + e.velocityX * 0.08, -maxP, maxP);
      const finalTy = clamp(curTy + e.velocityY * 0.08, -maxP, maxP);

      committedTx.current = finalTx;
      committedTy.current = finalTy;

      // Commit current visual position with no jump
      baseTxAnim.setValue(curTx);
      panTxAnim.setValue(0);
      baseTyAnim.setValue(curTy);
      panTyAnim.setValue(0);

      // Glide to momentum target
      Animated.parallel([
        Animated.timing(baseTxAnim, { toValue: finalTx, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(baseTyAnim, { toValue: finalTy, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  };

  // --- Double tap to zoom ---
  const onDoubleTap = ({ nativeEvent: e }: any) => {
    if (e.state === State.ACTIVE) {
      if (committedScale.current > 1.5) {
        resetAll(true);
      } else {
        committedScale.current = 2.5;
        Animated.spring(baseScaleAnim, { toValue: 2.5, useNativeDriver: true, overshootClamping: true, tension: 100, friction: 10 }).start();
      }
    }
  };

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={() => resetAll(false)}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.backdrop}>
          <TapGestureHandler
            ref={doubleTapRef}
            onHandlerStateChange={onDoubleTap}
            numberOfTaps={2}
          >
            <Animated.View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <PanGestureHandler
                ref={panRef}
                onGestureEvent={onPanEvent}
                onHandlerStateChange={onPanStateChange}
                simultaneousHandlers={pinchRef}
                minDist={8}
                avgTouches
              >
                <Animated.View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <PinchGestureHandler
                    ref={pinchRef}
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                    simultaneousHandlers={panRef}
                  >
                    <Animated.View
                      style={[styles.imgWrap, {
                        transform: [
                          { translateX: totalTx },
                          { translateY: totalTy },
                          { scale: totalScale },
                        ],
                      }]}
                    >
                      <Image source={{ uri: uri ?? '' }} style={styles.img} contentFit="contain" />
                    </Animated.View>
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </TapGestureHandler>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close-circle" size={34} color="#fff" />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgWrap: {
    width: SCREEN_W,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
  },
});
