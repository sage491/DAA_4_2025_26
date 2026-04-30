def lps_recursive(s, i, j):
    if i == j:
        return 1
    if s[i] == s[j] and i + 1 == j:
        return 2
    if s[i] == s[j]:
        return 2 + lps_recursive(s, i+1, j-1)    
    return max(lps_recursive(s, i+1, j), lps_recursive(s, i, j-1))
