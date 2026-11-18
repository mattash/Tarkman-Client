#import <React/RCTBridgeModule.h>

// Target membership is supplied only by the explicit isolated product plugin.
// No Expo module/package autolinking or provider replacement is needed.
@interface RCT_EXTERN_MODULE(TarkmanServiceProgress, NSObject)
RCT_EXTERN_METHOD(presentService:(nonnull NSNumber *)serviceID
                  readerAPI:(nonnull NSString *)readerAPI
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
