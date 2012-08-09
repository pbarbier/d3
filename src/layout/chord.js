d3.layout.chord = function() {
  var chord = {},
      chords,
      groups,
      matrix,
      relationships, // [{ source: int, target: int, value: dbl }]
      n,
      padding = 0,
      sortGroups,
      sortSubgroups,
      sortChords;

  function relayout() {
    var subgroups = {},
        groupSums = [],
        groupIndex = d3.range(n),
        subgroupIndex = [],
        k,
        x,
        x0,
        i,
        j;

    chords = [];
    groups = [];

    if (matrix) {
      // Compute the sum.
      k = 0, i = -1; while (++i < n) {
        x = 0, j = -1; while (++j < n) {
          x += matrix[i][j];
        }
        groupSums.push(x);
        subgroupIndex.push(d3.range(n));
        k += x;
      }

      // Sort groups…
      if (sortGroups) {
        groupIndex.sort(function(a, b) {
          return sortGroups(groupSums[a], groupSums[b]);
        });
      }

      // Sort subgroups…
      if (sortSubgroups) {
        subgroupIndex.forEach(function(d, i) {
          d.sort(function(a, b) {
            return sortSubgroups(matrix[i][a], matrix[i][b]);
          });
        });
      }

      // Convert the sum to scaling factor for [0, 2pi].
      // TODO Allow start and end angle to be specified.
      // TODO Allow padding to be specified as percentage?
      k = (2 * Math.PI - padding * n) / k;

      // Compute the start and end angle for each group and subgroup.
      // Note: Opera has a bug reordering object literal properties!
      x = 0, i = -1; while (++i < n) {
        x0 = x, j = -1; while (++j < n) {
          var di = groupIndex[i],
              dj = subgroupIndex[di][j],
              v = matrix[di][dj],
              a0 = x,
              a1 = x += v * k;
          subgroups[di + "-" + dj] = {
            index: di,
            subindex: dj,
            startAngle: a0,
            endAngle: a1,
            value: v
          };
        }
        groups.push({
          index: di,
          startAngle: x0,
          endAngle: x,
          value: (x - x0) / k
        });
        x += padding;
      }

      // Generate chords for each (non-empty) subgroup-subgroup link.
      i = -1; while (++i < n) {
        j = i - 1; while (++j < n) {
          var source = subgroups[i + "-" + j],
              target = subgroups[j + "-" + i];
          if (source.value || target.value) {
            chords.push(source.value < target.value
                ? {source: target, target: source}
                : {source: source, target: target});
          }
        }
      }

      if (sortChords) resort();
    }
    // Otherwise, use the relationships.
    else if (relationships) {
      // Calculate group sums.
      k = 0;
      relationships.forEach(function(rel) {
        x = rel.value;
        groupSums[rel.source] = groupSums[rel.source] || 0 + x;
        k += x;
        if (rel.source !== rel.target) {
          k += x;
          groupSums[rel.target] = groupSums[rel.target] || 0 + x;
        }
      });

      // Only add padding for groups with a value.
      var n0 = 0;
      groupSums.forEach(function(sum) {
        if (sum) n0++;
      });

      // Convert the sum to scaling factor for [0, 2pi].
      // TODO Allow start and end angle to be specified.
      // TODO Allow padding to be specified as percentage?
      k = (2 * Math.PI - padding * n0) / k;

      // Calculate groups and chords.
      // For i = 0 to n, loop through all relationships in order.  Add each relationship value to the group; 
      // add any chords with a value on the spot.  (Note that we're using 'subgroups' differently here than
      // above; here it is used to maintain a list of chords indexed by "source-target").
      var gp, chd;
      x = 0; i = -1; while (++i < n) {
        gp = { index: i, startAngle: x, value: 0 };
        // First check for relationships where i is the source, as they should come first.
        j = 0;
        relationships.forEach(function(rel) {
          if (rel.source !== i || rel.value === 0) return;
          gp.value += rel.value;
          chd = subgroups[i + '-' + rel.target] || (subgroups[i + '-' + rel.target] = {});
          chd.source = {
            index: i,
            subindex: j,
            startAngle: x,
            endAngle: x += (rel.value * k),
            value: rel.value
          };
          // Special handling for self-targetting relationships.
          if (rel.target === i) chd.target = chd.source;
          j++;
        });
        // Then check for relationships where i is the target.
        relationships.forEach(function(rel) {
          if (rel.source === i) return; // This special case was handled above.
          if (rel.target !== i || rel.value === 0) return;
          gp.value += rel.value;
          chd = subgroups[rel.source + '-' + i] || (subgroups[rel.source + '-' + i] = {});
          chd.target = {
            index: i,
            subindex: j,
            startAngle: x,
            endAngle: x += (rel.value * k),
            value: rel.value
          };
          j++;
        });
        // If the group value has increased beyond zero, calculate endAngle and add to groups.
        if (!gp.value) continue;
        gp.endAngle = x;
        groups.push(gp);
        x += padding;
      }

      // Move chords from subgroups object to chords array.
      i = -1; while(++i < n) {
        j = -1; while(++j < n) {
          gp = subgroups[i + '-' + j]
          if (gp) chords.push(gp)
        }
      }

    }
  }

  function resort() {
    chords.sort(function(a, b) {
      return sortChords(
        (a.source.value + a.target.value) / 2,
        (b.source.value + b.target.value) / 2);
    });
  }

  chord.matrix = function(x) {
    if (!arguments.length) return matrix;
    n = (matrix = x) && matrix.length;
    chords = groups = null;
    return chord;
  };

  chord.relationships = function(x) {
    if (!arguments.length) return relationships;
    relationships = x;
    chords = groups = null;
    relationships.forEach(function(rel) {
      n = Math.max(n || 0, rel.source + 1, rel.target + 1); // Note that n is 1-based.
    });
    return chord;
  };

  chord.addRelationship = function(sourceIndex, targetIndex, value) {
    relationships = relationships || [];
    relationships.push({source: sourceIndex, target: targetIndex, value: value});
    chords = groups = null;
    n = Math.max(n || 0, sourceIndex + 1, targetIndex + 1); // Note that n is 1-based.
    return chord;
  }

  chord.padding = function(x) {
    if (!arguments.length) return padding;
    padding = x;
    chords = groups = null;
    return chord;
  };

  chord.sortGroups = function(x) {
    if (!arguments.length) return sortGroups;
    sortGroups = x;
    chords = groups = null;
    return chord;
  };

  chord.sortSubgroups = function(x) {
    if (!arguments.length) return sortSubgroups;
    sortSubgroups = x;
    chords = null;
    return chord;
  };

  chord.sortChords = function(x) {
    if (!arguments.length) return sortChords;
    sortChords = x;
    if (chords) resort();
    return chord;
  };

  chord.chords = function() {
    if (!chords) relayout();
    return chords;
  };

  chord.groups = function() {
    if (!groups) relayout();
    return groups;
  };

  return chord;
};
