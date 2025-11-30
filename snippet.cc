
Napi::Value Replay::getReplayData(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    
    if (!this->decompressedBuffer) {
        return env.Null();
    }
    
    // Get remaining data from current cursor position to end of buffer
    std::size_t remainingSize = this->decompressedBuffer->size() - this->decompressedBuffer->getCursor();
    
    if (remainingSize == 0) {
        return env.Null();
    }
    
    // Create a new Node.js Buffer with the remaining data
    auto buffer = Napi::Buffer<uint8_t>::Copy(env, 
        this->decompressedBuffer->data() + this->decompressedBuffer->getCursor(), 
        remainingSize);
    
    return buffer;
}
