/* eslint-disable import/order */
import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { FlashList, FlashListProps } from ".";

interface Layout {
  y: number;
  height: number;
}
interface Props<T> extends FlashListProps<T> {
  customRef?: MutableRefObject<FlashList<T> | null>;
  indicatorWidth?: number;
}

interface CalcIndicatorPositionProps {
  wholeAreaHeight?: number;
  wholeContentHeight?: number;
  totalItemNumber?: number;
  startIndex: number;
  endIndex: number;
  startItemLayout?: Layout;
  endItemLayout?: Layout;
}

interface CalcIndicatorPositionRet {
  indicatorHeight: number;
  indicatorPosition: number;
  indicatorCoverWholeArea: boolean;
}

const MIN_INDICATOR_HEIGHT = 10;
// Calc scroll bar from start and end index
const calcIndicatorPosition = ({
  wholeAreaHeight,
  totalItemNumber,
  startIndex,
  endIndex,
  wholeContentHeight,
}: CalcIndicatorPositionProps): CalcIndicatorPositionRet => {
  const fixedTotalItemNumber = totalItemNumber ?? 1;
  const visibleAreaItemNumber = endIndex - startIndex + 1;
  const fixedWholeAreaHeight = wholeAreaHeight ?? 0;

  // |**--------| 0.0
  // |------**--| 0.8
  // |--------**| 1.0
  const indicatorPositionRatio =
    fixedTotalItemNumber - visibleAreaItemNumber === 0
      ? 0
      : startIndex / (fixedTotalItemNumber - visibleAreaItemNumber);

  // |*---------| 0.1
  // |*****-----| 0.5
  // |**********| 1.0
  const indicatorHeightRatio = visibleAreaItemNumber / fixedTotalItemNumber;

  // if wholeAreaHeight:100, totalItemNumber:10, startIndex: 2, endIndex: 3
  // |--**------| => indicatorHeightPx: 20, indicatorPositionPx: 20
  // if wholeAreaHeight:100, totalItemNumber:10, startIndex: 8, endIndex: 9
  // |--------**| => indicatorHeightPx: 20, indicatorPositionPx: 80
  const indicatorHeightPx = Math.max(
    fixedWholeAreaHeight * indicatorHeightRatio,
    MIN_INDICATOR_HEIGHT
  );
  const indicatorPositionPx =
    indicatorPositionRatio * (fixedWholeAreaHeight - indicatorHeightPx);

  // If wholeContentHeight is less than wholeAreaHeight, All item is shown.
  let indicatorCoverWholeArea = false;
  if (wholeAreaHeight != null && wholeContentHeight != null) {
    indicatorCoverWholeArea = wholeContentHeight <= wholeAreaHeight;
  }

  return {
    indicatorHeight: indicatorHeightPx,
    indicatorPosition: indicatorPositionPx,
    indicatorCoverWholeArea,
  };
};

const FlashListWithIndicesBasedIndicator = <T,>(props: Props<T>) => {
  const {
    onLayout,
    onContentSizeChange,
    onVisibleIndicesChanged,
    ...restProps
  } = props;

  const [visibleIndexes, setVisibleIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  }>({ startIndex: 0, endIndex: 0 });

  const [wholeAreaHeight, setWholeAreaHeight] = useState(0);
  const [wholeContentHeight, setWholeContentHeight] = useState(0);
  const [shouldShowIndicator, setShouldShowIndicator] = useState(false);
  const flashListRef = useRef<FlashList<T> | null>(null);

  const animatedScrollBarHeight = useRef(new Animated.Value(0)).current;
  const animatedScrollBarTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // get layout properties from internal recyclerListView
    const startItemLayout =
      flashListRef.current?.recyclerlistview_unsafe?.getLayout(
        visibleIndexes.startIndex
      );
    const endItemLayout =
      flashListRef.current?.recyclerlistview_unsafe?.getLayout(
        visibleIndexes.endIndex
      );

    const { indicatorHeight, indicatorPosition, indicatorCoverWholeArea } =
      calcIndicatorPosition({
        startIndex: visibleIndexes.startIndex,
        endIndex: visibleIndexes.endIndex,
        startItemLayout,
        endItemLayout,
        wholeAreaHeight,
        wholeContentHeight,
        totalItemNumber: props.data?.length,
      });

    setShouldShowIndicator(!indicatorCoverWholeArea);

    Animated.timing(animatedScrollBarHeight, {
      toValue: indicatorHeight,
      duration: 50,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedScrollBarTranslateY, {
      toValue: indicatorPosition,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, [
    visibleIndexes,
    wholeAreaHeight,
    wholeContentHeight,
    animatedScrollBarHeight,
    animatedScrollBarTranslateY,
    props.data?.length,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setWholeAreaHeight(height);
      // pass to props
      onLayout?.(event);
    },
    [setWholeAreaHeight, onLayout]
  );

  const handleContentSizeChange = useCallback(
    (width: number, contentHeight: number) => {
      setWholeContentHeight(contentHeight);

      // pass to props
      onContentSizeChange?.(width, contentHeight);
    },
    [setWholeContentHeight, onContentSizeChange]
  );

  const handleVisibleIndicesChanged = useCallback(
    (all: number[], now: number[], notNow: number[]) => {
      const startIndex = all.at(0);
      const endIndex = all.at(-1);

      if (startIndex != null && endIndex != null) {
        setVisibleIndexes({ startIndex, endIndex });
      }

      // pass to props
      onVisibleIndicesChanged?.(all, now, notNow);
    },
    [onVisibleIndicesChanged, setVisibleIndexes]
  );

  const setRefs = useCallback(
    (el: FlashList<T>) => {
      // inner
      flashListRef.current = el;
      // outer
      if (props.customRef != null) {
        props.customRef.current = el;
      }
    },
    [props.customRef]
  );

  // optional props
  const indicatorWidth: StyleProp<ViewStyle> =
    props.indicatorWidth == null ? undefined : { width: props.indicatorWidth };
  const showsVerticalScrollIndicator =
    props.showsVerticalScrollIndicator !== false;
  const indicatorVisible: StyleProp<ViewStyle> =
    showsVerticalScrollIndicator && shouldShowIndicator
      ? undefined
      : { display: "none" };

  return (
    <View style={styles.container}>
      <FlashList
        {...restProps}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        onVisibleIndicesChanged={handleVisibleIndicesChanged}
        ref={setRefs}
        showsVerticalScrollIndicator={false}
      />
      <Animated.View
        style={[
          styles.indicatorStyle,
          styles.defaultOptionalIndicatorStyle,
          indicatorWidth,
          indicatorVisible,
          {
            height: animatedScrollBarHeight,
            transform: [{ translateY: animatedScrollBarTranslateY }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  indicatorStyle: {
    position: "absolute",
    right: 0,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  defaultOptionalIndicatorStyle: {
    width: 10,
  },
});

export default FlashListWithIndicesBasedIndicator;
