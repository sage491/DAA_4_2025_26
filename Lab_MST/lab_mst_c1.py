class Solution:
    def maxOfSubarrays(self, arr, k):
        result = []
        
        for i in range(len(arr) - k + 1):
            window_max = max(arr[i:i+k])
            result.append(window_max)
        
        return result